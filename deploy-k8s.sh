#!/bin/bash

set -e

echo "🚀 Iniciando despliegue en Minikube/Kubernetes..."
echo ""

# Verificar que Minikube está corriendo
echo "✓ Verificando que Minikube está activo..."
if ! minikube status | grep -i "running" > /dev/null; then
    echo "❌ Minikube no está corriendo. Inicia con: minikube start"
    echo ""
    echo "Estado actual:"
    minikube status
    exit 1
fi
echo "✓ Minikube activo"
echo ""

# Configurar Docker para usar Minikube
echo "✓ Configurando Docker para Minikube..."
eval $(minikube docker-env)
echo ""

# Cambiar al directorio raíz del proyecto
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

echo "📦 Reconstruyendo imágenes Docker..."
echo ""

# 1. Dashboard (React + Vite)
echo "🎨 1/3 Construyendo dashboard..."
cd "$PROJECT_ROOT/monitoreoDashboardEspacios"
docker build -t yepez-sagnay-parra-dashboard:latest .
echo "✓ Dashboard construido"
echo ""

# 2. Tickets service (NestJS)
echo "🎫 2/3 Construyendo tickets service..."
cd "$PROJECT_ROOT/tickets"
docker build -t yepez-sagnay-parra-tickets:latest .
echo "✓ Tickets service construido"
echo ""

# 3. Vehicles service (NestJS)
echo "🚗 3/3 Construyendo vehicles service..."
cd "$PROJECT_ROOT/vehicles"
docker build -t yepez-sagnay-parra-vehicles:latest .
echo "✓ Vehicles service construido"
echo ""

echo "📡 Aplicando manifiestos de Kubernetes..."
echo ""

# Aplicar los manifiestos en orden (la mayoría dependen del namespace)
cd "$PROJECT_ROOT/k8s"

echo "→ Namespace..."
kubectl apply -f 00-namespace.yaml

echo "→ ConfigMap y Secrets..."
kubectl apply -f 02-configmap.yaml
kubectl apply -f 01-secret.yaml

echo "→ Bases de datos..."
kubectl apply -f 10-rabbitmq.yaml
kubectl apply -f 11-users-db.yaml
kubectl apply -f 12-vehicles-db.yaml
kubectl apply -f 13-zones-db.yaml
kubectl apply -f 14-assignments-db.yaml
kubectl apply -f 15-tickets-db.yaml
kubectl apply -f 16-audit-db.yaml

echo "→ Microservicios..."
kubectl apply -f 20-users.yaml
kubectl apply -f 21-vehicles.yaml     # ← Actualizado
kubectl apply -f 22-zones.yaml
kubectl apply -f 23-assignments.yaml
kubectl apply -f 24-tickets.yaml      # ← Actualizado
kubectl apply -f 25-ms-audit.yaml

echo "→ API Gateway..."
kubectl apply -f 30-kong-config.yaml
kubectl apply -f 31-kong.yaml

echo "→ Dashboard..."
kubectl apply -f 40-dashboard.yaml    # ← Actualizado

echo "→ Ingress..."
kubectl apply -f 41-ingress.yaml

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "📊 Estado de los pods:"
kubectl get pods -n yepez-sagnay-parra
echo ""
echo "🌐 Acceso a los servicios:"
echo "  • Dashboard:     http://$(minikube ip):$(kubectl get svc -n yepez-sagnay-parra dashboard -o jsonpath='{.spec.ports[0].nodePort}')"
echo "  • API Gateway:   http://$(minikube ip):$(kubectl get svc -n yepez-sagnay-parra kong-admin -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo '9001')"
echo "  • Swagger UI:    http://$(minikube ip):9000/docs"
echo ""
echo "💡 Para ver logs de un pod:"
echo "  kubectl logs -n yepez-sagnay-parra <pod-name> -f"
echo ""
echo "🔄 Para redeploy (sin reconstruir):"
echo "  kubectl rollout restart deployment/dashboard -n yepez-sagnay-parra"
echo "  kubectl rollout restart deployment/vehicles -n yepez-sagnay-parra"
echo "  kubectl rollout restart deployment/tickets -n yepez-sagnay-parra"
