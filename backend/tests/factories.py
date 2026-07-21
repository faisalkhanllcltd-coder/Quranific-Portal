"""
tests/factories.py — Factory Boy model factories for the test suite.

Each factory creates a real Django ORM object using CREATE DATABASE-backed
transactions. All factories are self-contained: creating a UserFactory
also creates the auto-signal Profile (see accounts/models.py signals).
"""
import factory
from factory.django import DjangoModelFactory
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from accounts.models import Profile, TeacherProfile
from students.models import Student, Attendance
from payments.models import Payment


# ─────────────────────────────────────────────────────────────────────────────
# 1. USER + PROFILE FACTORIES
# ─────────────────────────────────────────────────────────────────────────────

class UserFactory(DjangoModelFactory):
    """
    Creates a Django User with a pre-hashed password.

    Password is hashed via make_password() at User.objects.create() time so
    it is persisted in the initial INSERT — no post-generation save needed.
    Role subclasses set skip_postgeneration_save=True so their set_role hook
    (which only saves Profile) doesn't trigger a redundant User re-save.
    """
    class Meta:
        model = User

    username   = factory.Sequence(lambda n: f"testuser_{n}")
    # make_password() hashes 'TestPass123!' at factory-build time → stored in DB on INSERT
    password   = factory.LazyFunction(lambda: make_password("TestPass123!"))
    email      = factory.LazyAttribute(lambda o: f"{o.username}@test.quranific.com")
    first_name = factory.Faker("first_name")
    last_name  = factory.Faker("last_name")


def _make_user_with_role(role: str) -> User:
    """Helper: create a User whose Profile.user_type is set to `role`."""
    user = UserFactory()
    profile = user.profile          # auto-created by signal
    profile.user_type = role
    profile.save(update_fields=["user_type"])
    return user


class OwnerUserFactory(UserFactory):
    """User with user_type='owner'."""
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "owner"
            obj.profile.save(update_fields=["user_type"])


class HeadManagerUserFactory(UserFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "head_manager"
            obj.profile.save(update_fields=["user_type"])


class ManagerUserFactory(UserFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "manager"
            obj.profile.save(update_fields=["user_type"])


class TeacherUserFactory(UserFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "teacher"
            obj.profile.save(update_fields=["user_type"])
            # Ensure TeacherProfile exists (signal normally handles this,
            # but explicitly create to avoid race conditions in tests)
            TeacherProfile.objects.get_or_create(profile=obj.profile)


class StudentUserFactory(UserFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "student"
            obj.profile.save(update_fields=["user_type"])


class ParentUserFactory(UserFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    @factory.post_generation
    def set_role(obj, create, extracted, **kwargs):
        if create:
            obj.profile.user_type = "parent"
            obj.profile.save(update_fields=["user_type"])


# ─────────────────────────────────────────────────────────────────────────────
# 2. STUDENT FACTORY
# ─────────────────────────────────────────────────────────────────────────────

class StudentFactory(DjangoModelFactory):
    class Meta:
        model = Student

    full_name           = factory.Faker("name")
    # age is NOT NULL IntegerField — required, no default in the model
    age                 = factory.Faker("random_int", min=5, max=25)
    gender              = "Male"
    email               = factory.Faker("email")
    # whatsapp max_length=20 — numerify gives exactly 10 digits, safe under limit
    whatsapp            = factory.LazyFunction(lambda: __import__('faker').Faker().numerify("+1##########"))
    guardian_name       = factory.Faker("name")
    guardian_relation   = "Parent"
    guardian_email      = factory.Faker("email")
    # guardian_whatsapp max_length=20 — same constraint as whatsapp
    guardian_whatsapp   = factory.LazyFunction(lambda: __import__('faker').Faker().numerify("+1##########"))
    status              = "Joined"
    assigned_teacher    = None     # set explicitly in tests that need isolation
    parent_account      = None     # set to a ParentUserFactory() when needed


# ─────────────────────────────────────────────────────────────────────────────
# 3. ATTENDANCE FACTORY
# ─────────────────────────────────────────────────────────────────────────────

class AttendanceFactory(DjangoModelFactory):
    class Meta:
        model = Attendance

    student = factory.SubFactory(StudentFactory)
    date    = factory.Faker("date_this_year")
    status  = "Present"


# ─────────────────────────────────────────────────────────────────────────────
# 4. PAYMENT FACTORY
# ─────────────────────────────────────────────────────────────────────────────

class PaymentFactory(DjangoModelFactory):
    class Meta:
        model = Payment

    student        = factory.SubFactory(StudentFactory)
    amount         = factory.Faker("pydecimal", left_digits=4, right_digits=2, positive=True)
    month_paid_for = "2026-07"       # override per-test when testing duplicates
    status         = "Paid"
    method         = "Manual"        # matches Payment.method field (not payment_method)
