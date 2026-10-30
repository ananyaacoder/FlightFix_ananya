import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.http import FileResponse, HttpResponse

def serve_frontend_index(request):
    index_path = os.path.join(settings.FRONTEND_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    return HttpResponse("FlightFix MRO Django Backend Operational. API is available at /api/")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('', serve_frontend_index, name='frontend_index'),
    re_path(r'^(?P<path>.*)$', serve, {'document_root': settings.FRONTEND_DIR}),
]
