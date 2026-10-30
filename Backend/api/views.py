import json
import random
import os
from pathlib import Path
from datetime import datetime

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password

from .models import (
    CrewUser, Aircraft, Part, WorkOrder,
    PurchaseOrder, FlightRoute, Technician, ActivityFeed
)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / 'data'
MRO_DB_FILE = DATA_DIR / 'mro_db.json'
USERS_FILE = DATA_DIR / 'users.json'


# ==============================================================================
# Helper functions for database seeding and JSON synchronization
# ==============================================================================

def load_json_file(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return None

def save_json_file(filepath, data):
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error writing to {filepath}: {e}")

def get_full_state_from_db_or_json():
    """Retrieve full MRO state from SQLite if populated, otherwise fallback to mro_db.json."""
    try:
        ac_count = Aircraft.objects.count()
        if ac_count > 0:
            return {
                'ac': [a.to_dict() for a in Aircraft.objects.all()],
                'parts': [p.to_dict() for p in Part.objects.all()],
                'wo': [w.to_dict() for w in WorkOrder.objects.all()],
                'po': [po.to_dict() for po in PurchaseOrder.objects.all()],
                'routes': [r.to_dict() for r in FlightRoute.objects.all()],
                'technicians': [t.to_dict() for t in Technician.objects.all()],
                'feed': [f.to_dict() for f in ActivityFeed.objects.order_by('-id')[:30]],
            }
    except Exception:
        pass

    # Fallback to mro_db.json
    data = load_json_file(MRO_DB_FILE)
    if data:
        return data

    return {
        'ac': [], 'parts': [], 'wo': [], 'po': [],
        'routes': [], 'technicians': [], 'feed': []
    }


# Password verification & secure hashing helpers
def verify_user_password(raw_password, stored_password):
    if not raw_password or not stored_password:
        return False
    # 1. Plain text comparison (for legacy seeded accounts)
    if raw_password == stored_password:
        return True
    # 2. Django PBKDF2/SHA256 password hash check
    try:
        if check_password(raw_password, stored_password):
            return True
    except Exception:
        pass
    # 3. Simple SHA256 fallback
    try:
        import hashlib
        sha = hashlib.sha256(raw_password.encode('utf-8')).hexdigest()
        if sha == stored_password:
            return True
    except Exception:
        pass
    return False

def hash_password(raw_password):
    try:
        return make_password(raw_password)
    except Exception:
        import hashlib
        return hashlib.sha256(raw_password.encode('utf-8')).hexdigest()


# ==============================================================================
# 1. AUTHENTICATION VIEWS (/api/auth)
# ==============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def auth_login(request):
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'error': 'Invalid JSON body'}, status=400)

    raw_id = payload.get('identifier') or payload.get('email') or payload.get('employeeId') or ''
    ident = raw_id.strip()
    password = (payload.get('password') or '').strip()

    if not ident or not password:
        return JsonResponse({'success': False, 'error': 'Registered email or employee ID and password are required.'}, status=400)

    matched_user = None

    # 1. Check SQLite database (by email or employee_id, case-insensitive)
    try:
        user_obj = CrewUser.objects.filter(
            models.Q(email__iexact=ident) | models.Q(employee_id__iexact=ident)
        ).first()
        if user_obj and verify_user_password(password, user_obj.password):
            # If stored as plain-text, upgrade to secure hashed password
            if user_obj.password == password:
                user_obj.password = hash_password(password)
                user_obj.save(update_fields=['password'])
            matched_user = user_obj.to_dict()
    except Exception as e:
        print("[Auth Login] SQLite lookup error:", e)

    # 2. Check users.json fallback / sync
    users = load_json_file(USERS_FILE) or []
    json_matched = None
    for idx, u in enumerate(users):
        match_email = u.get('email', '').strip().lower() == ident.lower()
        match_emp = u.get('employeeId', '').strip().lower() == ident.lower()
        if (match_email or match_emp) and verify_user_password(password, u.get('password')):
            json_matched = u
            # If plain text, upgrade in json too
            if u.get('password') == password:
                users[idx]['password'] = hash_password(password)
                save_json_file(USERS_FILE, users)
            break

    if not matched_user and json_matched:
        matched_user = {
            'id': json_matched.get('id'),
            'name': json_matched.get('name'),
            'email': json_matched.get('email'),
            'employeeId': json_matched.get('employeeId'),
            'role': json_matched.get('role', 'Field Technician'),
            'clearance': json_matched.get('clearance', 'Clearance Alpha'),
            'station': json_matched.get('station', 'JFK'),
        }
        # Sync into SQLite
        try:
            CrewUser.objects.get_or_create(
                email__iexact=json_matched.get('email'),
                defaults={
                    'name': json_matched.get('name', 'Crew Member'),
                    'email': json_matched.get('email'),
                    'employee_id': json_matched.get('employeeId', f"EMP-{random.randint(1000, 9999)}"),
                    'password': json_matched.get('password'),
                    'role': json_matched.get('role', 'Field Technician'),
                    'clearance': json_matched.get('clearance', 'Clearance Alpha'),
                    'station': json_matched.get('station', 'JFK'),
                }
            )
        except Exception:
            pass

    if not matched_user:
        return JsonResponse({
            'success': False,
            'error': 'Invalid credentials. Please verify your registered email/employee ID and password.'
        }, status=401)

    token = f"flightfix_{int(datetime.now().timestamp() * 1000)}"
    return JsonResponse({
        'success': True,
        'token': token,
        'user': matched_user
    })


@csrf_exempt
@require_http_methods(["POST"])
def auth_signup(request):
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'error': 'Invalid JSON body'}, status=400)

    email = (payload.get('email') or '').strip().lower()
    password = (payload.get('password') or '').strip()
    name = (payload.get('name') or '').strip() or 'Flight Crew Member'
    raw_role = (payload.get('role') or 'user').strip().lower()
    role = 'admin' if 'admin' in raw_role else 'user'
    role_display = 'Company Admin' if role == 'admin' else 'Field Technician'
    clearance = payload.get('clearance') or ('Clearance Alpha' if role == 'admin' else 'Clearance Bravo')
    station = (payload.get('station') or 'JFK').strip().upper()
    employee_id = (payload.get('employeeId') or payload.get('employee_id') or '').strip()

    if not email:
        return JsonResponse({'success': False, 'error': 'Official work email is required.'}, status=400)
    if not password or len(password) < 6:
        return JsonResponse({'success': False, 'error': 'Password must be at least 6 characters long for security and integrity.'}, status=400)
    if not employee_id:
        employee_id = f"EMP-{random.randint(1000, 9999)}"

    # 1. STRICT DUPLICATE PREVENTION IN SQLITE
    try:
        if CrewUser.objects.filter(email__iexact=email).exists():
            return JsonResponse({
                'success': False,
                'error': f"The email '{email}' is already registered to an existing account. Duplicate accounts are prohibited. Please sign in."
            }, status=409)
        if CrewUser.objects.filter(employee_id__iexact=employee_id).exists():
            return JsonResponse({
                'success': False,
                'error': f"The Employee ID '{employee_id}' is already registered to an existing crew member. Duplicate IDs are prohibited."
            }, status=409)
    except Exception as e:
        print("[Auth Signup] DB check error:", e)

    # 2. STRICT DUPLICATE PREVENTION IN USERS.JSON
    users = load_json_file(USERS_FILE) or []
    for u in users:
        u_email = u.get('email', '').strip().lower()
        u_emp = u.get('employeeId', '').strip().lower()
        if u_email == email:
            return JsonResponse({
                'success': False,
                'error': f"The email '{email}' is already registered. Duplicate accounts are prohibited. Please sign in."
            }, status=409)
        if u_emp == employee_id.lower():
            return JsonResponse({
                'success': False,
                'error': f"The Employee ID '{employee_id}' is already registered to an existing crew member. Duplicate IDs are prohibited."
            }, status=409)

    # 3. SECURELY HASH PASSWORD FOR PRIVACY & INTEGRITY
    hashed_pass = hash_password(password)

    new_user_dict = {
        'id': int(datetime.now().timestamp() * 1000),
        'name': name,
        'email': email,
        'employeeId': employee_id,
        'role': role_display,
        'clearance': clearance,
        'station': station,
    }

    # 4. SAVE INTO SQLITE
    try:
        user_obj = CrewUser.objects.create(
            name=name,
            email=email,
            employee_id=employee_id,
            password=hashed_pass,
            role=role_display,
            clearance=clearance,
            station=station
        )
        new_user_dict = user_obj.to_dict()
    except Exception as e:
        print("[Auth Signup] DB insert error:", e)

    # 5. SAVE INTO USERS.JSON (With hashed password)
    users.append({**new_user_dict, 'password': hashed_pass})
    save_json_file(USERS_FILE, users)

    # Return response WITHOUT password for privacy
    return JsonResponse({
        'success': True,
        'message': f"Account registered successfully for {name} [{role_display}].",
        'user': new_user_dict
    }, status=201)


def auth_me(request):
    return JsonResponse({'success': True, 'status': 'active'})


# ==============================================================================
# 2. STATE SYNC (/api/sync)
# ==============================================================================

@csrf_exempt
def sync_state(request):
    if request.method == 'GET':
        state = get_full_state_from_db_or_json()
        return JsonResponse({'success': True, 'state': state})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid state payload'}, status=400)

        # Sync workorders to SQLite if present
        if isinstance(body, dict) and isinstance(body.get('wo'), list):
            for wo in body['wo']:
                wo_id = str(wo.get('id') or '')
                if wo_id:
                    WorkOrder.objects.update_or_create(
                        wo_id=wo_id,
                        defaults={
                            'aircraft': wo.get('aircraft') or wo.get('a', 'VT-FLB'),
                            'title': wo.get('title') or f"{wo.get('k', 'Check')} on {wo.get('a', 'Aircraft')}",
                            'kind': wo.get('kind') or wo.get('k', 'A-Check'),
                            'bay': wo.get('bay') or wo.get('b', 'Bay 1'),
                            'day': wo.get('day') or wo.get('d', 'Mon'),
                            'status': wo.get('status') or wo.get('s', 'open'),
                            'checklist': wo.get('checklist') or wo.get('c', []),
                            'parts': wo.get('parts') or wo.get('p', []),
                        }
                    )

        # Save to mro_db.json
        save_json_file(MRO_DB_FILE, body)
        return JsonResponse({'success': True, 'message': 'Full MRO state synchronized to server'})

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


# ==============================================================================
# 3. AIRCRAFT & TELEMETRY (/api/aircraft, /api/fleet)
# ==============================================================================

@csrf_exempt
def aircraft_list_create(request):
    if request.method == 'GET':
        state = get_full_state_from_db_or_json()
        return JsonResponse({'success': True, 'data': state.get('ac', [])})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        state = get_full_state_from_db_or_json()
        new_id = body.get('id') or f"ac_{int(datetime.now().timestamp() * 1000)}"
        body['id'] = new_id
        body['createdAt'] = datetime.utcnow().isoformat() + 'Z'
        state.setdefault('ac', []).append(body)
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': body}, status=201)

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def aircraft_detail(request, ac_id):
    state = get_full_state_from_db_or_json()
    ac_list = state.get('ac', [])

    matched = None
    matched_idx = -1
    for idx, item in enumerate(ac_list):
        if str(item.get('id')) == str(ac_id) or str(item.get('reg')) == str(ac_id) or str(item.get('r')) == str(ac_id):
            matched = item
            matched_idx = idx
            break

    if not matched:
        return JsonResponse({'success': False, 'message': 'Aircraft not found'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'data': matched})

    elif request.method in ['PUT', 'PATCH']:
        try:
            updates = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        matched.update(updates)
        matched['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        ac_list[matched_idx] = matched
        state['ac'] = ac_list
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': matched})

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@require_http_methods(["GET"])
def aircraft_telemetry(request, ac_id):
    state = get_full_state_from_db_or_json()
    ac_list = state.get('ac', [])

    matched = None
    for item in ac_list:
        if str(item.get('id')) == str(ac_id) or str(item.get('reg')) == str(ac_id) or str(item.get('r')) == str(ac_id):
            matched = item
            break

    if not matched:
        return JsonResponse({'success': False, 'message': 'Aircraft not found'}, status=404)

    telemetry = {
        'aircraftId': matched.get('id', ac_id),
        'reg': matched.get('reg') or matched.get('r', 'N/A'),
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'turbofan': {
            'n1Speed': f"{(88.0 + random.random() * 1.5):.1f}%",
            'n2Speed': f"{(94.0 + random.random() * 0.8):.1f}%",
            'egt': f"{round(635 + random.random() * 20)}°C",
            'oilPressure': f"{round(55 + random.random() * 6)} PSI",
            'vibration': f"{(0.12 + random.random() * 0.05):.2f} in/s"
        },
        'hydraulics': {
            'sysAPressure': f"{round(2980 + random.random() * 50)} PSI",
            'sysBPressure': f"{round(3010 + random.random() * 40)} PSI",
            'fluidTemp': f"{round(48 + random.random() * 4)}°C"
        },
        'flightControls': {
            'elevatorTrim': '-2.2° UP',
            'rudderOffset': '0.0°',
            'flapsSetting': '0° (Clean)',
            'slatPosition': 'Retracted'
        },
        'environment': {
            'cabinAltitude': f"{round(6100 + random.random() * 100)} ft",
            'diffPressure': f"{(8.1 + random.random() * 0.2):.2f} PSI",
            'cabinTemp': '21.5°C'
        }
    }

    return JsonResponse({'success': True, 'data': telemetry})


# ==============================================================================
# 4. WORK ORDERS (/api/workorders)
# ==============================================================================

@csrf_exempt
def workorders_list_create(request):
    if request.method == 'GET':
        status_filter = request.GET.get('status')
        priority_filter = request.GET.get('priority')

        qs = WorkOrder.objects.all().order_by('id')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if priority_filter:
            qs = qs.filter(priority=priority_filter)

        data = [w.to_dict() for w in qs]
        return JsonResponse({'success': True, 'data': data})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        new_id = str(body.get('id') or f"WO-{int(datetime.now().timestamp() % 100000)}")
        ac_reg = body.get('aircraft') or body.get('a', 'VT-FLB')
        kind_val = body.get('kind') or body.get('k', 'A-Check')
        bay_val = body.get('bay') or body.get('b', 'Bay 1')
        day_val = body.get('day') or body.get('d', 'Mon')
        status_val = body.get('status') or body.get('s', 'open')
        priority_val = body.get('priority', 'Routine')
        checklist_val = body.get('checklist') or body.get('c', [])
        parts_val = body.get('parts') or body.get('p', [])
        title_val = body.get('title') or f"{kind_val} on {ac_reg}"

        wo_obj, _ = WorkOrder.objects.update_or_create(
            wo_id=new_id,
            defaults={
                'aircraft': ac_reg,
                'title': title_val,
                'kind': kind_val,
                'bay': bay_val,
                'day': day_val,
                'status': status_val,
                'priority': priority_val,
                'checklist': checklist_val,
                'parts': parts_val,
                'assigned_to': body.get('assignedTo') or 'Marcus Vance',
            }
        )

        # Log activity
        try:
            ActivityFeed.objects.create(
                user='Flight Dispatch',
                action=f"Created Work Order #{new_id} ({kind_val}) for {ac_reg} in {bay_val}",
                event_type='mro'
            )
        except Exception:
            pass

        # Sync to json as backup
        state = get_full_state_from_db_or_json()
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': wo_obj.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def workorder_detail(request, wo_id):
    wo_obj = WorkOrder.objects.filter(wo_id=str(wo_id)).first()
    if not wo_obj:
        try:
            wo_obj = WorkOrder.objects.filter(id=int(wo_id)).first()
        except (ValueError, TypeError):
            pass

    if request.method == 'GET':
        if not wo_obj:
            return JsonResponse({'success': False, 'message': 'Work order not found'}, status=404)
        return JsonResponse({'success': True, 'data': wo_obj.to_dict()})

    elif request.method in ['PATCH', 'PUT']:
        try:
            updates = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        if not wo_obj:
            return JsonResponse({'success': False, 'message': 'Work order not found'}, status=404)

        if 'status' in updates:
            wo_obj.status = updates['status']
        elif 's' in updates:
            wo_obj.status = updates['s']

        if 'checklist' in updates:
            wo_obj.checklist = updates['checklist']
        elif 'c' in updates:
            wo_obj.checklist = updates['c']

        if 'bay' in updates:
            wo_obj.bay = updates['bay']
        elif 'b' in updates:
            wo_obj.bay = updates['b']

        if 'day' in updates:
            wo_obj.day = updates['day']
        elif 'd' in updates:
            wo_obj.day = updates['d']

        wo_obj.save()

        # Sync to json as backup
        state = get_full_state_from_db_or_json()
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': wo_obj.to_dict()})

    elif request.method == 'DELETE':
        if wo_obj:
            wo_obj.delete()
        state = get_full_state_from_db_or_json()
        save_json_file(MRO_DB_FILE, state)
        return JsonResponse({'success': True, 'message': f'Work order #{wo_id} deleted'})

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def workorder_checklist_toggle(request, wo_id, step_idx):
    if request.method not in ['PATCH', 'POST']:
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)

    wo_obj = WorkOrder.objects.filter(wo_id=str(wo_id)).first()
    if not wo_obj:
        return JsonResponse({'success': False, 'message': 'Work order not found'}, status=404)

    checklist = list(wo_obj.checklist or [])
    try:
        idx = int(step_idx)
        if 0 <= idx < len(checklist):
            step = checklist[idx]
            if isinstance(step, list) and len(step) >= 2:
                step[1] = 0 if step[1] else 1
            elif isinstance(step, dict):
                step['done'] = not step.get('done', False)
            checklist[idx] = step
            wo_obj.checklist = checklist
            if wo_obj.status == 'open':
                wo_obj.status = 'progress'
            wo_obj.save()
    except (IndexError, ValueError) as e:
        return JsonResponse({'success': False, 'message': f'Invalid step index: {e}'}, status=400)

    state = get_full_state_from_db_or_json()
    save_json_file(MRO_DB_FILE, state)

    return JsonResponse({'success': True, 'data': wo_obj.to_dict()})


@csrf_exempt
@require_http_methods(["POST"])
def workorder_signoff(request, wo_id):
    wo_obj = WorkOrder.objects.filter(wo_id=str(wo_id)).first()
    if not wo_obj:
        return JsonResponse({'success': False, 'message': 'Work order not found'}, status=404)

    wo_obj.status = 'done'
    c = list(wo_obj.checklist or [])
    for item in c:
        if isinstance(item, list) and len(item) >= 2:
            item[1] = 1
        elif isinstance(item, dict):
            item['done'] = True
    wo_obj.checklist = c
    wo_obj.save()

    # Clear AOG and mark aircraft in_service
    ac_reg = wo_obj.aircraft
    ac_obj = Aircraft.objects.filter(reg__iexact=ac_reg).first()
    if not ac_obj and str(ac_reg).isdigit():
        ac_obj = Aircraft.objects.filter(id=int(ac_reg)).first()
    if ac_obj:
        ac_obj.aog = False
        ac_obj.status = 'in_service'
        ac_obj.save()

    # Log in activity feed
    try:
        ActivityFeed.objects.create(
            user='Lead Tech',
            action=f"Certified airworthy: Work Order #{wo_id} signed off for {ac_reg}.",
            event_type='mro'
        )
    except Exception:
        pass

    state = get_full_state_from_db_or_json()
    save_json_file(MRO_DB_FILE, state)

    return JsonResponse({
        'success': True,
        'data': wo_obj.to_dict(),
        'message': f"Work order #{wo_id} certified. Aircraft {ac_reg} is released to service!"
    })


# ==============================================================================
# 5. PARTS INVENTORY (/api/parts)
# ==============================================================================

@csrf_exempt
def parts_list_create(request):
    state = get_full_state_from_db_or_json()
    parts = state.get('parts', [])

    if request.method == 'GET':
        ata_filter = request.GET.get('ata')
        filtered = parts
        if ata_filter:
            filtered = [p for p in filtered if ata_filter.lower() in p.get('ataChapter', '').lower()]
        return JsonResponse({'success': True, 'data': filtered})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        new_id = body.get('id') or f"p_{int(datetime.now().timestamp() * 1000)}"
        body['id'] = new_id
        state.setdefault('parts', []).append(body)
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': body}, status=201)

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def part_detail(request, part_id):
    state = get_full_state_from_db_or_json()
    parts = state.get('parts', [])

    matched = None
    matched_idx = -1
    for idx, item in enumerate(parts):
        if str(item.get('id')) == str(part_id) or str(item.get('partNo')) == str(part_id):
            matched = item
            matched_idx = idx
            break

    if not matched:
        return JsonResponse({'success': False, 'message': 'Part not found'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'data': matched})

    elif request.method in ['PATCH', 'PUT']:
        try:
            updates = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        matched.update(updates)
        if 'quantity' in updates:
            matched['qty'] = updates['quantity']
            matched['q'] = updates['quantity']

        parts[matched_idx] = matched
        state['parts'] = parts
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': matched})

    elif request.method == 'DELETE':
        parts.pop(matched_idx)
        state['parts'] = parts
        save_json_file(MRO_DB_FILE, state)
        return JsonResponse({'success': True, 'message': 'Part removed'})

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
@require_http_methods(["POST"])
def part_restock(request, part_id):
    state = get_full_state_from_db_or_json()
    parts = state.get('parts', [])

    matched = next((p for p in parts if str(p.get('id')) == str(part_id) or str(p.get('partNo')) == str(part_id)), None)
    if not matched:
        return JsonResponse({'success': False, 'message': 'Part not found'}, status=404)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
        add_qty = int(body.get('qty', 5))
    except Exception:
        add_qty = 5

    curr_qty = matched.get('qty') or matched.get('q', 0)
    new_qty = curr_qty + add_qty
    matched['qty'] = new_qty
    matched['q'] = new_qty

    min_qty = matched.get('minQty') or matched.get('m', 1)
    matched['status'] = 'low_stock' if new_qty <= min_qty else 'in_stock'

    save_json_file(MRO_DB_FILE, state)
    return JsonResponse({'success': True, 'data': matched})


# ==============================================================================
# 6. PROCUREMENT & ERP (/api/procurement)
# ==============================================================================

@csrf_exempt
def procurement_list_create(request):
    state = get_full_state_from_db_or_json()
    pos = state.get('po', [])

    if request.method == 'GET':
        return JsonResponse({'success': True, 'data': pos})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        new_id = body.get('id') or f"po_{int(datetime.now().timestamp() * 1000)}"
        body['id'] = new_id
        body['status'] = body.get('status', 'pending')
        body['s'] = body.get('s', 'pending')
        state.setdefault('po', []).append(body)
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': body}, status=201)

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
@require_http_methods(["PATCH"])
def procurement_approve(request, po_id):
    state = get_full_state_from_db_or_json()
    pos = state.get('po', [])

    matched = next((o for o in pos if str(o.get('id')) == str(po_id)), None)
    if not matched:
        return JsonResponse({'success': False, 'message': 'PO not found'}, status=404)

    matched['status'] = 'approved'
    matched['s'] = 'approved'
    save_json_file(MRO_DB_FILE, state)

    return JsonResponse({'success': True, 'data': matched})


@csrf_exempt
@require_http_methods(["POST", "PATCH"])
def procurement_receive(request, po_id):
    state = get_full_state_from_db_or_json()
    pos = state.get('po', [])
    parts = state.get('parts', [])

    matched = next((o for o in pos if str(o.get('id')) == str(po_id)), None)
    if not matched:
        return JsonResponse({'success': False, 'message': 'PO not found'}, status=404)

    matched['status'] = 'received'
    matched['s'] = 'received'

    # Auto-increment inventory stock
    part_id = matched.get('partId') or matched.get('p')
    qty = matched.get('quantity') or matched.get('q', 0)

    if part_id:
        target_part = next((p for p in parts if p.get('id') == part_id or p.get('partNo') == part_id), None)
        if target_part:
            curr_q = target_part.get('qty') or target_part.get('q', 0)
            target_part['qty'] = curr_q + qty
            target_part['q'] = curr_q + qty
            target_part['status'] = 'in_stock'

    save_json_file(MRO_DB_FILE, state)
    return JsonResponse({'success': True, 'data': matched})


# ==============================================================================
# 7. ROUTES & TECHNICIANS (/api/routes, /api/technicians)
# ==============================================================================

@csrf_exempt
def routes_list_create(request):
    state = get_full_state_from_db_or_json()
    routes = state.get('routes', [])

    if request.method == 'GET':
        return JsonResponse({'success': True, 'data': routes})

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

        new_id = body.get('id') or f"rt_{int(datetime.now().timestamp() * 1000)}"
        body['id'] = new_id
        state.setdefault('routes', []).append(body)
        save_json_file(MRO_DB_FILE, state)

        return JsonResponse({'success': True, 'data': body}, status=201)

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def route_detail(request, route_id):
    state = get_full_state_from_db_or_json()
    routes = state.get('routes', [])

    matched_idx = next((i for i, r in enumerate(routes) if str(r.get('id')) == str(route_id)), -1)
    if matched_idx == -1:
        return JsonResponse({'success': False, 'message': 'Route not found'}, status=404)

    if request.method == 'PATCH':
        routes[matched_idx]['active'] = not routes[matched_idx].get('active', True)
        save_json_file(MRO_DB_FILE, state)
        return JsonResponse({'success': True, 'data': routes[matched_idx]})

    elif request.method == 'DELETE':
        routes.pop(matched_idx)
        save_json_file(MRO_DB_FILE, state)
        return JsonResponse({'success': True, 'message': 'Route deleted'})

    return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def technicians_list(request):
    state = get_full_state_from_db_or_json()
    return JsonResponse({'success': True, 'data': state.get('technicians', [])})


@csrf_exempt
@require_http_methods(["PATCH"])
def technician_assign(request, tech_id):
    state = get_full_state_from_db_or_json()
    techs = state.get('technicians', [])

    matched = next((t for t in techs if str(t.get('id')) == str(tech_id)), None)
    if not matched:
        return JsonResponse({'success': False, 'message': 'Technician not found'}, status=404)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    wo_id = body.get('workOrderId')
    matched['status'] = 'assigned' if wo_id else 'available'
    matched['currentWO'] = wo_id or None

    save_json_file(MRO_DB_FILE, state)
    return JsonResponse({'success': True, 'data': matched})


# ==============================================================================
# 8. DASHBOARDS (/api/admin/dashboard, /api/technician/dashboard)
# ==============================================================================

@require_http_methods(["GET"])
def admin_dashboard(request):
    state = get_full_state_from_db_or_json()
    ac = state.get('ac', [])
    pos = state.get('po', [])

    pending_pos = [p for p in pos if (p.get('status') == 'pending' or p.get('s') == 'pending')]

    return JsonResponse({
        'success': True,
        'aircraft': ac,
        'pendingPurchaseOrders': pending_pos,
        'metrics': {
            'totalAircraft': len(ac),
            'aogCount': sum(1 for a in ac if a.get('aog') or a.get('status') == 'aog'),
            'pendingPOCount': len(pending_pos)
        }
    })


@require_http_methods(["GET"])
def technician_dashboard(request):
    state = get_full_state_from_db_or_json()
    station = request.GET.get('station', 'JFK')
    wos = state.get('wo', [])

    assigned_wos = [w for w in wos if w.get('status') != 'done' and w.get('s') != 'done']

    return JsonResponse({
        'success': True,
        'station': station,
        'assignedWorkOrders': assigned_wos
    })
