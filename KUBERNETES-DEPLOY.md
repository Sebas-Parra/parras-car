# 🚀 Guía de Despliegue en Minikube/Kubernetes

## Resumen Rápido

```bash
# 1. Verifica que Minikube está corriendo
minikube status

# 2. Ejecuta el script de despliegue
./deploy-k8s.sh

# ¡Listo! Tu aplicación estará disponible en Kubernetes
```

---

## 📋 Instrucciones Detalladas

### **Requisitos Previos**

Instala estos programas:
- **Minikube** - https://minikube.sigs.k8s.io/docs/start/
- **kubectl** - https://kubernetes.io/docs/tasks/tools/
- **Docker** - https://www.docker.com/products/docker-desktop

Verifica que estén instalados:
```bash
minikube version
kubectl version --client
docker --version
```

### **Paso 1: Inicia Minikube**

```bash
# Inicia Minikube
minikube start

# Verifica que está corriendo
minikube status
```

Salida esperada:
```
minikube: Running
profile: minikube
apiserver: Running
kubeconfig: Configured
```

### **Paso 2: Ejecuta el Script de Despliegue**

```bash
cd /path/to/parras-car
./deploy-k8s.sh
```

**¿Qué hace el script?**

1. ✅ Verifica que Minikube está activo
2. 🐳 Configura Docker para usar Minikube
3. 🏗️ Reconstruye las 3 imágenes Docker:
   - `parras-car-dashboard:latest`
   - `parras-car-tickets:latest`
   - `parras-car-vehicles:latest`
4. 🔧 Aplica todos los manifiestos de Kubernetes (en orden)
5. 📊 Muestra URLs de acceso y estado de pods

### **Paso 3: Verifica el Estado**

```bash
# Ver todos los pods
kubectl get pods -n parras-car

# Ver servicios
kubectl get svc -n parras-car

# Ver deployments
kubectl get deployments -n parras-car
```

Esperado: Todos los pods deben estar en estado **Running** o **Completed**.

---

## 🌐 Acceder a la Aplicación

Después de ejecutar el script, verás algo como:

```
🌐 Acceso a los servicios:
  • Dashboard:     http://192.168.49.2:30123
  • API Gateway:   http://192.168.49.2:9000
  • Swagger UI:    http://192.168.49.2:9000/docs
```

### **Opción 1: Usar NodePort (directo)**

El script te muestra las URLs. Simplemente abre en tu navegador.

### **Opción 2: Usar Tunnel de Minikube**

```bash
# En una terminal, abre un tunnel
minikube tunnel

# En otra terminal, accede via localhost
# El puerto se asigna automáticamente
kubectl get svc -n parras-car
```

### **Opción 3: Port Forward**

```bash
# Redirige el puerto del dashboard localmente
kubectl port-forward -n parras-car svc/dashboard 5173:80

# Ahora accede a http://localhost:5173
```

---

## 🔄 Después de Hacer Cambios

### **Solo cambios en el código (sin Dockerfile)**

```bash
# Reconstruye solo la imagen que cambiaste
cd monitoreoDashboardEspacios  # o vehicles, o tickets
docker build -t parras-car-dashboard:latest .

# Reinicia el deployment
kubectl rollout restart deployment/dashboard -n parras-car
```

### **Cambios en dependencias o Dockerfile**

Ejecuta el script completo:
```bash
./deploy-k8s.sh
```

### **Cambios solo en configuración/secrets**

```bash
# Actualiza solo los configmaps/secrets
kubectl apply -f k8s/01-secret.yaml
kubectl apply -f k8s/02-configmap.yaml

# Reinicia los deployments para que lean los nuevos valores
kubectl rollout restart deployment -n parras-car
```

---

## 🐛 Troubleshooting

### **Los pods no arrancan**

```bash
# Ver detalles del pod
kubectl describe pod <pod-name> -n parras-car

# Ver logs
kubectl logs <pod-name> -n parras-car -f

# Eventos del namespace
kubectl get events -n parras-car
```

### **La imagen no se actualiza**

Asegúrate de:
1. Usar `imagePullPolicy: Never` en los manifiestos (ya está)
2. Haber ejecutado `eval $(minikube docker-env)` antes de `docker build`
3. Reconstruir CON un tag único o forzar pull:

```bash
# Opción 1: Forza recreación de pods
kubectl rollout restart deployment/dashboard -n parras-car

# Opción 2: Elimina el pod manualmente
kubectl delete pod -l app=dashboard -n parras-car
```

### **Minikube se reinició y todo quebró**

Las imágenes Docker se pierden. Reconstruye:
```bash
eval $(minikube docker-env)
./deploy-k8s.sh
```

### **El dashboard no carga los estilos CSS**

Problema típico: Nginx no está sirviendo correctamente. Verifica:
```bash
# Ver logs del nginx/dashboard
kubectl logs -n parras-car deployment/dashboard

# Verifica el configmap de nginx
kubectl get cm -n parras-car
```

---

## 📊 Monitoreo y Debugging

### **Ver logs en tiempo real**

```bash
# Todos los servicios
kubectl logs -n parras-car -f --tail=100

# Un servicio específico
kubectl logs -n parras-car -f deployment/vehicles

# Últimas 50 líneas
kubectl logs -n parras-car deployment/tickets --tail=50
```

### **Ver métricas**

```bash
# Uso de CPU/Memoria de cada pod
kubectl top pods -n parras-car

# Si no funciona, instala metrics-server
minikube addons enable metrics-server
```

### **Ejecutar comando dentro de un pod**

```bash
# Terminal interactiva
kubectl exec -it <pod-name> -n parras-car -- /bin/sh

# Ejecutar un comando
kubectl exec <pod-name> -n parras-car -- curl http://localhost:3000/health
```

### **Ver variables de entorno de un pod**

```bash
kubectl exec <pod-name> -n parras-car -- env | grep DB_
```

---

## 🧹 Limpiar Todo

```bash
# Eliminar todo el namespace (borra TODO)
kubectl delete namespace parras-car

# Parar Minikube sin eliminar datos
minikube stop

# Eliminar completamente Minikube
minikube delete
```

---

## 📝 Resumen de Cambios en Este Despliegue

Reconstruyes estas imágenes:

| Servicio | Cambios |
|----------|---------|
| **Dashboard** | UI nueva con grid de espacios, animaciones SSE, toggle tabla/grid |
| **Tickets** | SSE mejorado: emite eventos cuando crea/paga/cancela tickets |
| **Vehicles** | Asignación automática para clientes, filtrado de vehículos |

---

## 🎯 Próximos Pasos

1. Ejecuta `./deploy-k8s.sh`
2. Espera a que todos los pods estén en `Running`
3. Abre el dashboard en tu navegador
4. Prueba crear un ticket para ver el SSE en acción
5. ¡Disfruta de la nueva interfaz!

---

## 💡 Pro Tips

- **Ambiente local sin Minikube?** Usa `docker-compose up` directamente
- **¿Quieres cambiar el puerto del dashboard?** Edita `k8s/40-dashboard.yaml`
- **¿Agregar SSL/TLS?** Configura el Ingress en `k8s/41-ingress.yaml`
- **¿Más réplicas?** Cambia `replicas: 1` en cualquier deployment
