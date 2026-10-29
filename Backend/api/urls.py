from django.urls import re_path
from . import views

urlpatterns = [
    # Auth Endpoints
    re_path(r'^auth/login/?$', views.auth_login, name='auth_login'),
    re_path(r'^auth/signup/?$', views.auth_signup, name='auth_signup'),
    re_path(r'^auth/register/?$', views.auth_signup, name='auth_register'),
    re_path(r'^auth/me/?$', views.auth_me, name='auth_me'),

    # Full State Synchronization
    re_path(r'^sync/?$', views.sync_state, name='sync_state'),

    # Aircraft & Fleet Endpoints
    re_path(r'^aircraft/?$', views.aircraft_list_create, name='aircraft_list_create'),
    re_path(r'^fleet/?$', views.aircraft_list_create, name='fleet_list_create'),
    re_path(r'^aircraft/(?P<ac_id>[^/]+)/telemetry/?$', views.aircraft_telemetry, name='aircraft_telemetry'),
    re_path(r'^aircraft/(?P<ac_id>[^/]+)/?$', views.aircraft_detail, name='aircraft_detail'),

    # Work Order Endpoints
    re_path(r'^workorders/?$', views.workorders_list_create, name='workorders_list_create'),
    re_path(r'^workorders/(?P<wo_id>[^/]+)/checklist/(?P<step_idx>[^/]+)/?$', views.workorder_checklist_toggle, name='workorder_checklist_toggle'),
    re_path(r'^workorders/(?P<wo_id>[^/]+)/signoff/?$', views.workorder_signoff, name='workorder_signoff'),
    re_path(r'^workorders/(?P<wo_id>[^/]+)/status/?$', views.workorder_detail, name='workorder_status'),
    re_path(r'^workorders/(?P<wo_id>[^/]+)/?$', views.workorder_detail, name='workorder_detail'),

    # Parts Inventory Endpoints
    re_path(r'^parts/?$', views.parts_list_create, name='parts_list_create'),
    re_path(r'^parts/(?P<part_id>[^/]+)/restock/?$', views.part_restock, name='part_restock'),
    re_path(r'^parts/(?P<part_id>[^/]+)/?$', views.part_detail, name='part_detail'),

    # Procurement Endpoints
    re_path(r'^procurement/?$', views.procurement_list_create, name='procurement_list_create'),
    re_path(r'^procurement/(?P<po_id>[^/]+)/approve/?$', views.procurement_approve, name='procurement_approve'),
    re_path(r'^procurement/(?P<po_id>[^/]+)/receive/?$', views.procurement_receive, name='procurement_receive'),

    # Flight Routes Endpoints
    re_path(r'^routes/?$', views.routes_list_create, name='routes_list_create'),
    re_path(r'^routes/(?P<route_id>[^/]+)/toggle/?$', views.route_detail, name='route_toggle'),
    re_path(r'^routes/(?P<route_id>[^/]+)/?$', views.route_detail, name='route_detail'),

    # Technicians Endpoints
    re_path(r'^technicians/?$', views.technicians_list, name='technicians_list'),
    re_path(r'^technicians/(?P<tech_id>[^/]+)/assign/?$', views.technician_assign, name='technician_assign'),

    # Dashboards Endpoints
    re_path(r'^admin/dashboard/?$', views.admin_dashboard, name='admin_dashboard'),
    re_path(r'^technician/dashboard/?$', views.technician_dashboard, name='technician_dashboard'),
]
