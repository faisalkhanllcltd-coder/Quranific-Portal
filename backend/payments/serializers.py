from rest_framework import serializers
from decimal import Decimal
from students.models import Student
from .models import Payment
import re

class PaymentCreateSerializer(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    month_paid_for = serializers.CharField(max_length=7)
    method = serializers.CharField(max_length=50, required=False, default='Manual')

    def validate_month_paid_for(self, value):
        if not re.match(r'^\d{4}-\d{2}$', value):
            raise serializers.ValidationError("Format must be YYYY-MM")
        return value
