from django.contrib import admin
from .models import (
    CrewUser, Aircraft, Part, WorkOrder,
    PurchaseOrder, FlightRoute, Technician, ActivityFeed
)

@admin.register(CrewUser)
class CrewUserAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'name', 'email', 'role', 'clearance', 'station')
    search_fields = ('name', 'email', 'employee_id')
    list_filter = ('role', 'clearance', 'station')

@admin.register(Aircraft)
class AircraftAdmin(admin.ModelAdmin):
    list_display = ('reg', 'model', 'status', 'aog', 'location', 'flight_hours', 'cycles')
    search_fields = ('reg', 'model', 'serial')
    list_filter = ('status', 'aog', 'location')

@admin.register(Part)
class PartAdmin(admin.ModelAdmin):
    list_display = ('part_id', 'name', 'ata_chapter', 'qty', 'min_qty', 'status')
    search_fields = ('part_id', 'name', 'ata_chapter')
    list_filter = ('status', 'ata_chapter')

@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ('wo_id', 'aircraft', 'title', 'status', 'priority', 'assigned_to')
    search_fields = ('wo_id', 'aircraft', 'title')
    list_filter = ('status', 'priority')

@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('po_id', 'part_id', 'quantity', 'status', 'total_cost')
    search_fields = ('po_id', 'part_id')
    list_filter = ('status',)

@admin.register(FlightRoute)
class FlightRouteAdmin(admin.ModelAdmin):
    list_display = ('flight_number', 'origin', 'destination', 'scheduled_departure', 'active')
    search_fields = ('flight_number', 'origin', 'destination')
    list_filter = ('active',)

@admin.register(Technician)
class TechnicianAdmin(admin.ModelAdmin):
    list_display = ('tech_id', 'name', 'role', 'station', 'status', 'current_wo')
    search_fields = ('tech_id', 'name', 'station')
    list_filter = ('status', 'station')

@admin.register(ActivityFeed)
class ActivityFeedAdmin(admin.ModelAdmin):
    list_display = ('category', 'message', 'timestamp')
    search_fields = ('category', 'message')
