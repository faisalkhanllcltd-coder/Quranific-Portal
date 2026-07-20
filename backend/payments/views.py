import os
import hashlib
import hmac
import logging
import datetime
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction, IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.pagination import PageNumberPagination  # A-P1-08: manual pagination
from django.contrib.auth import get_user_model
from .models import Payment
from accounts.models import Profile
from accounts.views import IsOwnerOrManager  # SECURITY FIX (A-P8-04): permission-layer gate

logger = logging.getLogger(__name__)
User = get_user_model()

# 2Checkout (Verifone) Credentials
TWOCHECKOUT_SECRET_WORD = os.environ.get('TWOCHECKOUT_SECRET_WORD', '')
TWOCHECKOUT_VENDOR_ID = os.environ.get('TWOCHECKOUT_VENDOR_ID', '')

class PaymentListView(APIView):
    """
    GET  /api/payments/ -> Returns payments for the Finance Hub.
                           Admin roles: full ledger. Parent: own children only.
    POST /api/payments/ -> Manually log a payment (admin roles only).

    SECURITY (A-P8-04): Permission enforcement happens at two layers:
      1. DRF permission class (get_permissions) — blocks non-admin requests
         before they enter the view body. POST requires IsOwnerOrManager.
      2. Inner user_type check — defence-in-depth inside the view body.
    """

    def get_permissions(self):
        """
        GET  — IsAuthenticated: parents need read access to see their children's
               payment history; further role-based filtering is done inside get().
        POST — IsOwnerOrManager: only owner / head_manager / manager may create
               manual payment records. Teachers and students are blocked here,
               before any view logic runs.
        """
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsOwnerOrManager()]

    def get(self, request):
        try:
            user_type = request.user.profile.user_type
        except Profile.DoesNotExist:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # PHASE 2 INTERCEPTOR: Route logic based on cryptographic role
        if user_type in ['owner', 'head_manager', 'manager']:
            # Admins see the global ledger
            payments = Payment.objects.select_related('student').all().order_by('-date_paid')
        elif user_type == 'parent':
            # Parents see ONLY the payments attached to their linked children
            payments = Payment.objects.filter(
                student__parent_account=request.user
            ).select_related('student').order_by('-date_paid')
        else:
            # Teachers and Students have no business in the master ledger
            return Response(status=status.HTTP_403_FORBIDDEN)

        # PAGINATION FIX (A-P1-08): APIView does not auto-paginate; apply manually.
        # Without this the full payments table was serialised and returned in one
        # response — a memory and bandwidth bomb on a mature academy's ledger.
        # Response shape: {count, next, previous, results: [...]}
        # Frontend must read response.data.results (was response.data).
        paginator = PageNumberPagination()
        paginator.page_size = 100          # Generous for a finance ledger
        paginator.max_page_size = 500      # Hard cap; honour ?page_size= up to this
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(payments, request)

        data = [
            {
                "id": p.id,
                "student": p.student.id,
                "amount": str(p.amount),
                "month_paid_for": p.month_paid_for,
                "method": p.method,
                "status": p.status,
                "date_paid": p.date_paid.isoformat(),
                "transaction_id": p.transaction_id
            }
            for p in page
        ]
        return paginator.get_paginated_response(data)

    def post(self, request):
        # Defence-in-depth: IsOwnerOrManager permission class already blocked
        # non-admin requests above. This check is a secondary safety net.
        try:
            user_type = request.user.profile.user_type
        except Profile.DoesNotExist:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # BUGFIX: manager is now included (was previously excluded despite having
        # read access — GET allowed manager but POST did not, inconsistent).
        if user_type not in ['owner', 'head_manager', 'manager']:
            return Response({"error": "Only admins can manually log payments."}, status=status.HTTP_403_FORBIDDEN)

        # R-R3-03: IDEMPOTENCY — read client-supplied key from header.
        # Standard HTTP convention: Idempotency-Key: <uuid>
        # If the key was already used for a successful payment, return that
        # payment's data with HTTP 200 (not 201) — no new row created.
        # If no key is provided, behaviour is unchanged (backward compatible).
        idem_key = request.headers.get('Idempotency-Key', '').strip() or None
        if idem_key:
            existing = Payment.objects.filter(idempotency_key=idem_key).first()
            if existing:
                return Response({
                    "id": existing.id,
                    "student": existing.student_id,
                    "amount": str(existing.amount),
                    "month_paid_for": existing.month_paid_for,
                    "method": existing.method,
                    "status": existing.status,
                    "date_paid": existing.date_paid.isoformat(),
                    "idempotency_key": existing.idempotency_key,
                    "replayed": True,   # Lets the client distinguish a replay from a fresh create
                }, status=status.HTTP_200_OK)

        from .serializers import PaymentCreateSerializer

        serializer = PaymentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            student_id = serializer.validated_data['student'].id
            from students.models import Student # Local import to avoid circular dependencies

            # ATOMIC LOCK: Prevent race conditions when updating student status
            with transaction.atomic():
                # Lock the specific student row until this transaction finishes
                student = Student.objects.select_for_update().get(id=student_id)
                month = serializer.validated_data['month_paid_for']

                # DUPLICATE GUARD (A-P2-04): Check before create so the admin
                # receives a clean 409 rather than an IntegrityError from the DB
                # constraint. Runs inside the atomic+select_for_update lock to
                # prevent a TOCTOU race on concurrent identical requests.
                if Payment.objects.filter(student=student, month_paid_for=month).exists():
                    return Response(
                        {"error": f"A payment for this student already exists for {month}."},
                        status=status.HTTP_409_CONFLICT,
                    )

                payment = Payment.objects.create(
                    student=student,
                    amount=serializer.validated_data['amount'],
                    month_paid_for=month,
                    method=serializer.validated_data.get('method', 'Manual'),
                    status='Paid',
                    idempotency_key=idem_key,   # None if not provided — stored as NULL
                )

                # Auto-update student status to Joined/Active upon payment
                if student.status != 'Joined':
                    student.status = 'Joined'
                    student.save(update_fields=['status'])

            return Response({
                "id": payment.id,
                "student": student.id,
                "amount": str(payment.amount),
                "month_paid_for": payment.month_paid_for,
                "method": payment.method,
                "status": payment.status,
                "date_paid": payment.date_paid.isoformat(),
                "idempotency_key": payment.idempotency_key,
            }, status=status.HTTP_201_CREATED)

        except Student.DoesNotExist:
            return Response({"error": "Student not found."}, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError as exc:
            # R-R3-03 RACE GUARD: Two concurrent requests with the same Idempotency-Key
            # can both pass the pre-check before either commits. The losing INSERT
            # raises IntegrityError on the unique idempotency_key column. The
            # transaction.atomic() block has already been rolled back at this point,
            # so the query below runs on a clean connection.
            if idem_key:
                raced = Payment.objects.filter(idempotency_key=idem_key).first()
                if raced:
                    logger.warning(
                        f"Idempotency-Key race recovered: key={idem_key!r}, "
                        f"returning existing payment #{raced.id}. "
                        f"IP: {request.META.get('REMOTE_ADDR')}"
                    )
                    return Response({
                        "id": raced.id,
                        "student": raced.student_id,
                        "amount": str(raced.amount),
                        "month_paid_for": raced.month_paid_for,
                        "method": raced.method,
                        "status": raced.status,
                        "date_paid": raced.date_paid.isoformat(),
                        "idempotency_key": raced.idempotency_key,
                        "replayed": True,
                    }, status=status.HTTP_200_OK)
            # IntegrityError from a different constraint (e.g. student+month) or
            # idem_key race where the winner's record can't be found — log and 500.
            logger.error(
                f"Manual Payment Creation Failed (IntegrityError): {exc} "
                f"- IP: {request.META.get('REMOTE_ADDR')}"
            )
            return Response(
                {"error": "An internal server error occurred while processing the payment."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            # SECURITY FIX: Do not leak raw stack traces to the frontend
            logger.error(f"Manual Payment Creation Failed: {str(e)} - IP: {request.META.get('REMOTE_ADDR')}")
            return Response({"error": "An internal server error occurred while processing the payment."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@csrf_exempt
def twocheckout_webhook(request):
    """
    POST /api/payments/webhook/2checkout/
    Secure endpoint for 2Checkout INS (Instant Notification Service)
    """
    if request.method != 'POST':
        return HttpResponse(status=405)

    # 1. Extract POST data sent by 2Checkout
    post_data = request.POST
    sale_id = post_data.get('sale_id', '')
    vendor_id = post_data.get('vendor_id', '')
    invoice_id = post_data.get('invoice_id', '')
    
    # Check for signature/hash (supporting standard and legacy payload keys)
    provided_signature = post_data.get('signature', post_data.get('hash', post_data.get('md5_hash', ''))).upper()

    # If key data is missing, reject it instantly
    if not sale_id or not vendor_id or not invoice_id or not provided_signature:
        logger.warning(f"2Checkout Webhook rejected: Missing critical parameters. IP: {request.META.get('REMOTE_ADDR')}")
        return HttpResponse("Missing Data", status=400)

    # 2. Cryptographic Verification (Anti-Fraud Armor)
    #
    # 2Checkout HMAC-SHA256 source string format (current spec, MD5 deprecated):
    #   For each field value: prepend its UTF-8 byte-length, then the value itself.
    #   Concatenate all prefixed values, then HMAC-SHA256 the result using
    #   SECRET_WORD as the key.
    #
    # WARNING: The field ORDER is account-specific — verify it in your Merchant
    # Control Panel under Integrations > Webhooks & API > IPN Settings.
    # The order below (sale_id, vendor_id, invoice_id) matches the legacy INS
    # format. If your control panel shows a different order, update accordingly.
    def _2co_hash_field(value):
        """Encode one field as: str(byte_length) + value (2Checkout byte-length prefix format)."""
        val_str = str(value)
        return str(len(val_str.encode('utf-8'))) + val_str

    ipn_fields = [sale_id, TWOCHECKOUT_VENDOR_ID, invoice_id]
    hash_source = ''.join(_2co_hash_field(f) for f in ipn_fields)

    # HMAC-SHA256: SECRET_WORD is the key; byte-length-prefixed field string is the message
    calculated_signature = hmac.new(
        TWOCHECKOUT_SECRET_WORD.encode('utf-8'),
        hash_source.encode('utf-8'),
        hashlib.sha256
    ).hexdigest().upper()

    # SECURITY FIX: Constant-time string comparison blocks cryptographic timing attacks
    if not hmac.compare_digest(calculated_signature, provided_signature):
        logger.critical(f"URGENT: 2Checkout signature mismatch! Possible spoofing attempt. IP: {request.META.get('REMOTE_ADDR')}")
        return HttpResponse("Signature Verification Failed", status=403)

    # 3. Process the Payment (If signature is valid)
    message_type = post_data.get('message_type', '')
    
    # Check if this is a successful charge
    if message_type in ['INVOICE_STATUS_CHANGED', 'ORDER_CREATED']:
        status_str = post_data.get('invoice_status', '')
        
        if status_str == 'approved':
            student_username = post_data.get('vendor_order_id', '') 
            amount = post_data.get('invoice_usd_amount', '0.00')
            
            try:
                from students.models import Student
                
                # ATOMIC LOCK: Eliminate duplicate payments from concurrent identical webhooks
                with transaction.atomic():
                    # Lock the student row for update
                    student = Student.objects.select_for_update().get(user__username=student_username)
                    
                    # Check if this transaction was already logged to prevent duplicates
                    if not Payment.objects.filter(transaction_id=invoice_id).exists():
                        # Generate current month string (YYYY-MM)
                        current_month = datetime.date.today().strftime('%Y-%m')
                        
                        Payment.objects.create(
                            student=student,
                            amount=amount,
                            month_paid_for=current_month,
                            method='2Checkout',
                            status='Paid',
                            transaction_id=invoice_id
                        )
                        
                        # Ensure student is marked as active
                        if student.status != 'Joined':
                            student.status = 'Joined'
                            student.save(update_fields=['status'])
                            
                        logger.info(f"2Checkout Auto-Payment logged securely for {student_username}")
                    
            except Student.DoesNotExist:
                logger.error(f"2Checkout Webhook: User {student_username} not found in database.")
            except Exception as e:
                logger.error(f"2Checkout Webhook processing error for {student_username}: {str(e)}")

    # 2Checkout requires a 200 OK response, or it will keep retrying the webhook
    return HttpResponse("OK", status=200)