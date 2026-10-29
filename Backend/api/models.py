from django.db import models

class CrewUser(models.Model):
    name = models.CharField(max_length=150)
    email = models.CharField(max_length=150, unique=True)
    employee_id = models.CharField(max_length=50, unique=True)
    password = models.CharField(max_length=150)
    role = models.CharField(max_length=100, default='Lead Flight Dispatcher')
    clearance = models.CharField(max_length=50, default='Clearance Alpha')
    station = models.CharField(max_length=50, default='JFK')
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'employeeId': self.employee_id,
            'role': self.role,
            'clearance': self.clearance,
            'station': self.station,
        }

    def __str__(self):
        return f"{self.name} ({self.employee_id} - {self.role})"


class Aircraft(models.Model):
    reg = models.CharField(max_length=50, unique=True)
    model = models.CharField(max_length=150, default='Boeing 737-800')
    serial = models.CharField(max_length=100, blank=True, default='')
    flight_hours = models.FloatField(default=0.0)
    cycles = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default='in_service')
    aog = models.BooleanField(default=False)
    location = models.CharField(max_length=100, default='JFK')
    last_check = models.CharField(max_length=50, blank=True, default='')
    next_check = models.CharField(max_length=50, blank=True, default='')
    assigned_flight = models.CharField(max_length=50, blank=True, default='')
    assigned_tech = models.CharField(max_length=150, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': f"ac_{self.id}",
            'reg': self.reg,
            'r': self.reg,
            'model': self.model,
            'm': self.model,
            'serial': self.serial,
            'flightHours': self.flight_hours,
            'h': self.flight_hours,
            'cycles': self.cycles,
            'c': self.cycles,
            'status': self.status,
            'aog': 1 if self.aog else 0,
            'location': self.location,
            'st': self.location,
            'lastCheck': self.last_check,
            'nextCheck': self.next_check,
            'assignedFlight': self.assigned_flight,
            'assignedTech': self.assigned_tech,
        }

    def __str__(self):
        return f"{self.reg} - {self.model} ({self.status})"


class Part(models.Model):
    part_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    ata_chapter = models.CharField(max_length=100, default='ATA 72')
    qty = models.IntegerField(default=0)
    min_qty = models.IntegerField(default=1)
    unit_cost = models.FloatField(default=0.0)
    supplier = models.CharField(max_length=150, blank=True, default='')
    status = models.CharField(max_length=50, default='in_stock')

    def to_dict(self):
        return {
            'id': self.part_id,
            'partNo': self.part_id,
            'name': self.name,
            'n': self.name,
            'ataChapter': self.ata_chapter,
            'qty': self.qty,
            'q': self.qty,
            'minQty': self.min_qty,
            'm': self.min_qty,
            'unitCost': self.unit_cost,
            'supplier': self.supplier,
            'status': self.status,
        }

    def __str__(self):
        return f"{self.part_id} - {self.name} (Qty: {self.qty})"


class WorkOrder(models.Model):
    wo_id = models.CharField(max_length=100, unique=True)
    aircraft = models.CharField(max_length=50)
    title = models.CharField(max_length=250)
    kind = models.CharField(max_length=100, blank=True, default='')
    bay = models.CharField(max_length=50, blank=True, default='Bay 1')
    day = models.CharField(max_length=50, blank=True, default='Mon')
    status = models.CharField(max_length=50, default='open')  # open, progress, done
    priority = models.CharField(max_length=50, default='Routine')
    checklist = models.JSONField(default=list, blank=True)
    parts = models.JSONField(default=list, blank=True)
    assigned_to = models.CharField(max_length=150, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        # Normalize checklist so it's always friendly [[step, 0 or 1], ...]
        normalized_c = []
        if isinstance(self.checklist, list):
            for item in self.checklist:
                if isinstance(item, list) and len(item) >= 2:
                    normalized_c.append([str(item[0]), 1 if item[1] else 0])
                elif isinstance(item, dict):
                    step_txt = item.get('step') or item.get('text') or item.get('task') or 'Inspection step'
                    done_val = 1 if item.get('done') else 0
                    normalized_c.append([str(step_txt), done_val])
                elif isinstance(item, str):
                    normalized_c.append([item, 0])

        normalized_status = self.status
        if normalized_status == 'in_progress':
            normalized_status = 'progress'
        elif normalized_status == 'closed':
            normalized_status = 'done'

        kind_name = self.kind or 'A-Check'
        aircraft_reg = self.aircraft or 'VT-FLB'

        return {
            'id': self.wo_id,
            'aircraft': aircraft_reg,
            'a': aircraft_reg,
            'title': self.title or f"{kind_name} on {aircraft_reg}",
            'kind': kind_name,
            'k': kind_name,
            'bay': self.bay or 'Bay 1',
            'b': self.bay or 'Bay 1',
            'day': self.day or 'Mon',
            'd': self.day or 'Mon',
            'status': normalized_status,
            's': normalized_status,
            'priority': self.priority or 'Routine',
            'checklist': normalized_c,
            'c': normalized_c,
            'parts': self.parts or [],
            'p': self.parts or [],
            'assignedTo': self.assigned_to or 'Lead Technician',
        }

    def __str__(self):
        return f"WO #{self.wo_id} - {self.aircraft} ({self.status})"


class PurchaseOrder(models.Model):
    po_id = models.CharField(max_length=100, unique=True)
    part_id = models.CharField(max_length=100)
    quantity = models.IntegerField(default=1)
    status = models.CharField(max_length=50, default='pending')  # pending, approved, received
    note = models.CharField(max_length=250, blank=True, default='')
    total_cost = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'id': self.po_id,
            'partId': self.part_id,
            'p': self.part_id,
            'quantity': self.quantity,
            'q': self.quantity,
            'status': self.status,
            's': self.status,
            'note': self.note,
            'totalCost': self.total_cost,
        }

    def __str__(self):
        return f"PO #{self.po_id} - {self.part_id} x{self.quantity} ({self.status})"


class FlightRoute(models.Model):
    route_id = models.CharField(max_length=100, unique=True)
    flight_number = models.CharField(max_length=50)
    origin = models.CharField(max_length=10)
    destination = models.CharField(max_length=10)
    scheduled_departure = models.CharField(max_length=50, blank=True, default='')
    distance = models.IntegerField(default=0)
    active = models.BooleanField(default=True)

    def to_dict(self):
        return {
            'id': self.route_id,
            'flightNumber': self.flight_number,
            'origin': self.origin,
            'destination': self.destination,
            'scheduledDeparture': self.scheduled_departure,
            'distance': self.distance,
            'active': self.active,
        }

    def __str__(self):
        return f"{self.flight_number}: {self.origin} -> {self.destination}"


class Technician(models.Model):
    tech_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=100, default='AME')
    station = models.CharField(max_length=50, default='JFK')
    clearance = models.CharField(max_length=50, default='Clearance Alpha')
    status = models.CharField(max_length=50, default='available')
    current_wo = models.CharField(max_length=100, blank=True, null=True, default=None)

    def to_dict(self):
        return {
            'id': self.tech_id,
            'name': self.name,
            'role': self.role,
            'station': self.station,
            'clearance': self.clearance,
            'status': self.status,
            'currentWO': self.current_wo,
        }

    def __str__(self):
        return f"{self.name} ({self.station} - {self.status})"


class ActivityFeed(models.Model):
    category = models.CharField(max_length=100)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            'category': self.category,
            'message': self.message,
            'timestamp': self.timestamp.isoformat() if self.timestamp else ''
        }

    def __str__(self):
        return f"[{self.category}] {self.message}"
