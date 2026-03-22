from django.core.management.base import BaseCommand
from apps.users.models import User, StudentRegistry
from apps.users.utils_encryption import encrypt, hash_value


class Command(BaseCommand):
    help = '기존 개인정보 암호화'

    def handle(self, *args, **kwargs):
        # User 암호화
        users = User.objects.filter(
            email_encrypted__isnull=True
        ) | User.objects.filter(
            student_id_encrypted__isnull=True
        )

        user_count = 0
        for user in users:
            updated = False
            if user.email and not user.email_encrypted:
                user.email_encrypted = encrypt(user.email)
                user.email_hash = hash_value(user.email)
                updated = True
            if user.student_id and not user.student_id_encrypted:
                user.student_id_encrypted = encrypt(user.student_id)
                user.student_id_hash = hash_value(user.student_id)
                updated = True
            if updated:
                user.save()
                user_count += 1

        self.stdout.write(f'User {user_count}명 암호화 완료')

        # StudentRegistry 암호화
        registries = StudentRegistry.objects.filter(
            student_id_encrypted__isnull=True
        )

        registry_count = 0
        for registry in registries:
            registry.student_id_encrypted = encrypt(registry.student_id)
            registry.student_id_hash = hash_value(registry.student_id)
            registry.name_encrypted = encrypt(registry.name)
            registry.name_hash = hash_value(registry.name)
            registry.save()
            registry_count += 1

        self.stdout.write(f'StudentRegistry {registry_count}개 암호화 완료')