from django.db import migrations, models


class Migration(migrations.Migration):
    """
    R-R3-03: Add idempotency_key to Payment.

    Nullable CharField so all existing rows (including 2Checkout webhook
    payments that use transaction_id instead) get NULL and remain valid.
    The unique=True index is the DB-level backstop; the view-level lookup
    is the primary path and returns a clean 200 before the INSERT happens.
    """

    dependencies = [
        ('payments', '0003_add_unique_payment_per_student_per_month'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='idempotency_key',
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
                help_text=(
                    'Client-supplied Idempotency-Key header value. Present only for '
                    'manually logged payments. Replaying the same key returns the '
                    'original response without creating a new record.'
                ),
            ),
        ),
    ]
