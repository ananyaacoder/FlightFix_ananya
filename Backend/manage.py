import os
import sys

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'flightfix_project.settings')

    # Detect port if passed
    port = "8000"
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        for arg in sys.argv[2:]:
            if arg.isdigit():
                port = arg
            elif ':' in arg and arg.split(':')[-1].isdigit():
                port = arg.split(':')[-1]

        frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Frontend'))
        print("=================================================================")
        print(f">> FLIGHTFIX MRO DJANGO SERVER ACTIVE ON PORT {port}")
        print(f">> Frontend folder:       {frontend_dir}")
        print(f">> Platform Web App:     http://127.0.0.1:{port}")
        print(f">> Company Admin API:    http://127.0.0.1:{port}/api/admin/dashboard")
        print(f">> Field Technician API: http://127.0.0.1:{port}/api/technician/dashboard")
        print(f">> Django Admin Panel:   http://127.0.0.1:{port}/admin")
        print("=================================================================")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Did you run 'pip install django django-cors-headers'?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
