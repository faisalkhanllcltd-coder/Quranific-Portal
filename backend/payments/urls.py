from django.urls import path
from .views import PaymentListView, twocheckout_webhook

urlpatterns = [
    # Used by your frontend React app (FinanceHub.jsx)
    path('', PaymentListView.as_view(), name='payment-list'),
    
    # The public, secure webhook URL you provide to 2Checkout in their dashboard
    path('webhook/2checkout/', twocheckout_webhook, name='twocheckout-webhook'),
]