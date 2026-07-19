from django.db import models
from students.models import Student

class Payment(models.Model):
    # 🛡️ SECURITY FIX: Hard-linked to the Student model, NOT the base Auth User.
    # This guarantees structural integrity for the Multi-Tenant Family Portal.
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    month_paid_for = models.CharField(max_length=7, help_text="Format: YYYY-MM")
    
    method = models.CharField(max_length=50, default="2Checkout")
    status = models.CharField(max_length=20, default="Paid")
    
    # 2Checkout specific tracking
    transaction_id = models.CharField(max_length=100, blank=True, null=True, unique=True)
    
    date_paid = models.DateTimeField(auto_now_add=True)

    # R-R3-03: Client-supplied idempotency key for manual payment deduplication.
    # Client sends `Idempotency-Key: <uuid>` header on POST.
    # Server returns the original 200 response instead of creating a duplicate
    # when the same key is submitted again. Nullable so existing records and
    # 2Checkout webhook payments (which use transaction_id instead) are unaffected.
    idempotency_key = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text=(
            "Client-supplied Idempotency-Key header value. Present only for manually "
            "logged payments. Replaying the same key returns the original response "
            "without creating a new record."
        ),
    )

    date_paid = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_paid']
        constraints = [
            # A-P2-04: Prevent duplicate payment records for the same student
            # in the same calendar month. The 2Checkout webhook already
            # deduplicates on transaction_id; this covers manual payments.
            # Named so application code can catch IntegrityError by constraint name.
            models.UniqueConstraint(
                fields=['student', 'month_paid_for'],
                name='unique_payment_per_student_per_month',
            ),
        ]

    def __str__(self):
        # Safely referencing the student's name instead of the raw auth username
        name = getattr(self.student, 'full_name', f"Student #{self.student.id}")
        return f"{name} - ${self.amount} ({self.month_paid_for})"