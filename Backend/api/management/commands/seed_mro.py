import json
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from api.models import (
    CrewUser, Aircraft, Part, WorkOrder,
    PurchaseOrder, FlightRoute, Technician, ActivityFeed
)

class Command(BaseCommand):
    help = 'Seeds SQLite database from FlightFix mro_db.json and users.json'

    def handle(self, *args, **options):
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        data_dir = base_dir.parent / 'data'
        mro_file = data_dir / 'mro_db.json'
        users_file = data_dir / 'users.json'

        self.stdout.write(self.style.NOTICE(f"Loading data from {data_dir}..."))

        # 1. Seed Users
        if os.path.exists(users_file):
            with open(users_file, 'r', encoding='utf-8') as f:
                users_data = json.load(f)
                for u in users_data:
                    CrewUser.objects.update_or_create(
                        email=u['email'].strip().lower(),
                        defaults={
                            'name': u.get('name', 'Flight Crew'),
                            'employee_id': u.get('employeeId', f"EMP-{u.get('id', 100)}"),
                            'password': u.get('password', 'Admin123!'),
                            'role': u.get('role', 'Lead Flight Dispatcher'),
                            'clearance': u.get('clearance', 'Clearance Alpha'),
                            'station': u.get('station', 'JFK'),
                        }
                    )
            self.stdout.write(self.style.SUCCESS(f"Seeded {len(users_data)} crew accounts."))

        # 2. Seed MRO DB
        if os.path.exists(mro_file):
            with open(mro_file, 'r', encoding='utf-8') as f:
                mro_data = json.load(f)

            # Aircraft
            for ac in mro_data.get('ac', []):
                reg = ac.get('reg') or ac.get('r')
                if not reg:
                    continue
                Aircraft.objects.update_or_create(
                    reg=reg,
                    defaults={
                        'model': ac.get('model') or ac.get('t') or ac.get('m', 'Boeing 737-800'),
                        'serial': ac.get('serial', ''),
                        'flight_hours': float(ac.get('flightHours') or ac.get('h', 0)),
                        'cycles': int(ac.get('cycles') or ac.get('c', 0)),
                        'status': ac.get('status', 'in_service'),
                        'aog': bool(ac.get('aog', 0)),
                        'location': ac.get('location') or ac.get('st', 'JFK'),
                        'last_check': ac.get('lastCheck', ''),
                        'next_check': ac.get('nextCheck', ''),
                        'assigned_flight': ac.get('assignedFlight', ''),
                        'assigned_tech': ac.get('assignedTech', ''),
                    }
                )

            # Ensure flagship fleet is present
            flagship_ac = [
                {'r': 'VT-FLA', 'm': 'Airbus A320neo', 'h': 12400, 'c': 4200, 'aog': 0, 'st': 'JFK'},
                {'r': 'VT-FLB', 'm': 'Airbus A320neo', 'h': 15850, 'c': 5100, 'aog': 0, 'st': 'LHR'},
                {'r': 'VT-FLC', 'm': 'Boeing 737-800', 'h': 9200,  'c': 3100, 'aog': 0, 'st': 'DXB'},
                {'r': 'VT-FLD', 'm': 'Boeing 777-300ER', 'h': 30110, 'c': 7400, 'aog': 1, 'st': 'SIN'},
                {'r': 'VT-FLE', 'm': 'Boeing 787-9', 'h': 18400, 'c': 4900, 'aog': 0, 'st': 'HND'},
            ]
            for fa in flagship_ac:
                Aircraft.objects.update_or_create(
                    reg=fa['r'],
                    defaults={
                        'model': fa['m'],
                        'flight_hours': fa['h'],
                        'cycles': fa['c'],
                        'status': 'aog' if fa['aog'] else 'in_service',
                        'aog': bool(fa['aog']),
                        'location': fa['st'],
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded aircraft fleet."))

            # Parts
            for p in mro_data.get('parts', []):
                pid = p.get('id') or p.get('partNo')
                if not pid:
                    continue
                Part.objects.update_or_create(
                    part_id=pid,
                    defaults={
                        'name': p.get('name') or p.get('n', pid),
                        'ata_chapter': p.get('ataChapter', 'ATA 72'),
                        'qty': int(p.get('qty') or p.get('q', 0)),
                        'min_qty': int(p.get('minQty') or p.get('m', 1)),
                        'unit_cost': float(p.get('unitCost', 0.0)),
                        'supplier': p.get('supplier', ''),
                        'status': p.get('status', 'in_stock'),
                    }
                )

            flagship_parts = [
                {'id': 'MW-2231', 'n': 'Main wheel assembly', 'q': 4, 'm': 3, 'cost': 8500},
                {'id': 'HP-887',  'n': 'Hydraulic pump',       'q': 2, 'm': 2, 'cost': 14200},
                {'id': 'BP-104',  'n': 'Brake pad set',        'q': 18, 'm': 8, 'cost': 3100},
                {'id': 'FF-552',  'n': 'Fuel filter',          'q': 6, 'm': 6, 'cost': 950},
            ]
            for fp in flagship_parts:
                Part.objects.update_or_create(
                    part_id=fp['id'],
                    defaults={
                        'name': fp['n'],
                        'qty': fp['q'],
                        'min_qty': fp['m'],
                        'unit_cost': fp['cost'],
                        'status': 'in_stock'
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded parts inventory."))

            # Work Orders
            default_tasks = {
                "A-Check": ["Visual walk-around", "Check fluid levels", "Inspect tyres and brakes", "Test avionics"],
                "C-Check": ["Structural inspection", "Landing gear overhaul", "Cabin systems test", "Engine borescope", "Flight control check"],
                "Engine Insp.": ["Borescope inspection", "Oil analysis", "Torque-check mounts"]
            }

            for wo in mro_data.get('wo', []):
                woid = str(wo.get('id') or '')
                if not woid:
                    continue
                ac_reg = wo.get('aircraft') or wo.get('reg') or wo.get('a', 'VT-FLB')
                kind_val = wo.get('kind') or wo.get('k') or ('C-Check' if 'Overhaul' in wo.get('title', '') else 'Engine Insp.' if 'Turbofan' in wo.get('title', '') else 'A-Check')
                status_raw = wo.get('status') or wo.get('s', 'open')
                if status_raw == 'in_progress':
                    status_raw = 'progress'
                elif status_raw == 'closed':
                    status_raw = 'done'

                raw_c = wo.get('checklist') or wo.get('c') or []
                norm_c = []
                if raw_c:
                    for item in raw_c:
                        if isinstance(item, dict):
                            norm_c.append([item.get('step', 'Task'), 1 if item.get('done') else 0])
                        elif isinstance(item, list) and len(item) >= 2:
                            norm_c.append([item[0], 1 if item[1] else 0])
                else:
                    norm_c = [[t, 0] for t in default_tasks.get(kind_val, ["Standard inspection"])]

                WorkOrder.objects.update_or_create(
                    wo_id=woid,
                    defaults={
                        'aircraft': ac_reg,
                        'title': wo.get('title') or f"{kind_val} on {ac_reg}",
                        'kind': kind_val,
                        'bay': wo.get('bay') or wo.get('b') or 'Bay 1',
                        'day': wo.get('day') or wo.get('d') or 'Mon',
                        'status': status_raw,
                        'priority': wo.get('priority', 'Routine'),
                        'checklist': norm_c,
                        'parts': wo.get('requiredParts') or wo.get('parts') or wo.get('p', []),
                        'assigned_to': wo.get('assignedTech') or wo.get('assignedTo', 'Marcus Vance'),
                    }
                )

            # Ensure flagship active work orders exist
            flagship_wos = [
                {
                    'id': '1', 'a': 'VT-FLB', 'k': 'C-Check', 'b': 'Bay 1', 'd': 'Mon', 's': 'progress',
                    'title': 'Scheduled C-Check Heavy Maintenance',
                    'parts': [{'id': 'BP-104', 'q': 4}],
                    'c': [
                        ['Structural inspection & rivet audit', 1],
                        ['Landing gear overhaul & seal test', 1],
                        ['Cabin environmental & pressurization test', 0],
                        ['Engine borescope & compressor check', 0],
                        ['Flight control fly-by-wire calibration', 0]
                    ],
                    'tech': 'Marcus Vance'
                },
                {
                    'id': '2', 'a': 'VT-FLD', 'k': 'Engine Insp.', 'b': 'Bay 3', 'd': 'Tue', 's': 'open',
                    'title': 'Turbine Hot Section Inspection',
                    'parts': [{'id': 'HP-887', 'q': 1}],
                    'c': [
                        ['Borescope inspection of turbine blades', 0],
                        ['Spectrometric oil analysis sample', 0],
                        ['Torque-check pylon mounting bolts', 0]
                    ],
                    'tech': 'Elena Rostova'
                }
            ]
            for fwo in flagship_wos:
                WorkOrder.objects.update_or_create(
                    wo_id=fwo['id'],
                    defaults={
                        'aircraft': fwo['a'],
                        'title': fwo['title'],
                        'kind': fwo['k'],
                        'bay': fwo['b'],
                        'day': fwo['d'],
                        'status': fwo['s'],
                        'priority': 'High' if fwo['s'] == 'progress' else 'Routine',
                        'checklist': fwo['c'],
                        'parts': fwo['parts'],
                        'assigned_to': fwo['tech'],
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded work orders."))

            # Purchase Orders
            for po in mro_data.get('po', []):
                poid = po.get('id')
                if not poid:
                    continue
                PurchaseOrder.objects.update_or_create(
                    po_id=poid,
                    defaults={
                        'part_id': po.get('partId') or po.get('p', ''),
                        'quantity': int(po.get('quantity') or po.get('q', 1)),
                        'status': po.get('status') or po.get('s', 'pending'),
                        'note': po.get('note', ''),
                        'total_cost': float(po.get('totalCost', 0.0)),
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded purchase orders."))

            # Flight Routes
            for r in mro_data.get('routes', []):
                rid = r.get('id')
                if not rid:
                    continue
                FlightRoute.objects.update_or_create(
                    route_id=rid,
                    defaults={
                        'flight_number': r.get('flightNumber', ''),
                        'origin': r.get('origin', ''),
                        'destination': r.get('destination', ''),
                        'scheduled_departure': r.get('scheduledDeparture', ''),
                        'distance': int(r.get('distance', 0)),
                        'active': bool(r.get('active', True)),
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded flight routes."))

            # Technicians
            for t in mro_data.get('technicians', []):
                tid = t.get('id')
                if not tid:
                    continue
                Technician.objects.update_or_create(
                    tech_id=tid,
                    defaults={
                        'name': t.get('name', 'Technician'),
                        'role': t.get('role', 'AME'),
                        'station': t.get('station', 'JFK'),
                        'clearance': t.get('clearance', 'Clearance Alpha'),
                        'status': t.get('status', 'available'),
                        'current_wo': t.get('currentWO'),
                    }
                )
            self.stdout.write(self.style.SUCCESS("Seeded technicians."))

        self.stdout.write(self.style.SUCCESS("[SUCCESS] FlightFix MRO SQLite Database successfully initialized and seeded!"))
