#!/usr/bin/env bash
# Carga datos de prueba rápido vía la API (a través del gateway/Ingress),
# logueado como root: zonas, espacios, vehículos, asignaciones y un ticket
# de ejemplo. No es idempotente — correrlo dos veces crea duplicados
# (y falla en la placa repetida, sin frenar el resto del script).
#
# Uso:
#   ./scripts/seed-demo-data.sh
#   BASE_URL=http://localhost:9000 SEED_USERNAME=admin SEED_PASSWORD=Admin123! ./scripts/seed-demo-data.sh

BASE_URL="${BASE_URL:-http://parras-car.local}"
USERNAME="${SEED_USERNAME:-root}"
PASSWORD="${SEED_PASSWORD:-Root123!}"

json_get() {
  python3 -c "import sys,json
try:
    print(json.load(sys.stdin)$1)
except Exception:
    print('')
"
}

auth_post() {
  curl -s -X POST "$BASE_URL$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"
}

echo "Iniciando sesión como $USERNAME..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/users/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | json_get "['access_token']")
USER_ID=$(echo "$LOGIN_RESPONSE" | json_get "['user_id']")

if [ -z "$TOKEN" ]; then
  echo "No se pudo iniciar sesión. Respuesta: $LOGIN_RESPONSE"
  exit 1
fi
echo "Login OK (user_id=$USER_ID)"

echo
echo "── Creando zonas ──"
ZONE_IDS=()

create_zone() {
  local resp id
  resp=$(auth_post "/api/zones/api/v1/zones" "{\"name\":\"$1\",\"description\":\"$2\",\"capacity\":$3,\"type\":\"$4\"}")
  id=$(echo "$resp" | json_get "['id']")
  if [ -z "$id" ]; then
    echo "  ! Error creando zona '$1': $resp"
  else
    echo "  + Zona '$1' -> $id"
    ZONE_IDS+=("$id")
  fi
}

create_zone "Zona Norte" "Zona regular de acceso norte" 20 REGULAR
create_zone "Zona VIP Sur" "Zona preferencial sur" 10 VIP
create_zone "Zona Externa" "Zona externa de visitantes" 15 EXTERNAL

echo
echo "── Creando espacios ──"
PLACE_IDS=()
PLACE_STATUS=()

create_place() {
  local resp id
  resp=$(auth_post "/api/zones/api/v1/places" "{\"idZone\":\"$1\",\"description\":\"$2\",\"type\":\"$3\",\"status\":\"$4\"}")
  id=$(echo "$resp" | json_get "['id']")
  if [ -z "$id" ]; then
    echo "  ! Error creando espacio: $resp"
  else
    echo "  + Espacio ($3/$4) -> $id"
    PLACE_IDS+=("$id")
    PLACE_STATUS+=("$4")
  fi
}

for zid in "${ZONE_IDS[@]}"; do
  create_place "$zid" "Espacio para autos" CAR AVAILABLE
  create_place "$zid" "Espacio para motos" BIKE AVAILABLE
  create_place "$zid" "Espacio en mantenimiento" CAR MAINTENANCE
done

echo
echo "── Creando vehículos ──"
VEHICLE_IDS=()
VEHICLE_PLATES=()

create_vehicle() {
  local resp id
  resp=$(auth_post "/api/vehicles/vehicles" "{\"tipo\":\"$1\",\"datos\":$2}")
  id=$(echo "$resp" | json_get "['id']")
  if [ -z "$id" ]; then
    echo "  ! Error creando vehículo $3: $resp"
  else
    echo "  + Vehículo $3 -> $id"
    VEHICLE_IDS+=("$id")
    VEHICLE_PLATES+=("$3")
  fi
}

create_vehicle "car" '{"plate":"ABC-1234","brand":"Toyota","model":"Corolla","color":"Blanco","year":2022,"clasification":"GASOLINE","numberOfDoors":4,"trunkCapacity":400}' "ABC-1234"
create_vehicle "car" '{"plate":"XYZ-5678","brand":"Kia","model":"Rio","color":"Azul","year":2021,"clasification":"GASOLINE","numberOfDoors":4,"trunkCapacity":350}' "XYZ-5678"
create_vehicle "motocicleta" '{"plate":"AB-123C","brand":"Yamaha","model":"FZ","color":"Negro","year":2023,"clasification":"GASOLINE","typeOfMotorbike":"SPORT"}' "AB-123C"
create_vehicle "pickupTruck" '{"plate":"PCK-9911","brand":"Ford","model":"Ranger","color":"Gris","year":2020,"clasification":"DIESEL","payloadCapacity":1200,"cab":"Doble"}' "PCK-9911"

echo
echo "── Asignando vehículos a $USERNAME ──"
for vid in "${VEHICLE_IDS[@]}"; do
  resp=$(auth_post "/api/assignments/assignments" "{\"user_id\":\"$USER_ID\",\"vehicle_id\":\"$vid\"}")
  ok=$(echo "$resp" | json_get "['vehicle_id']")
  if [ -z "$ok" ]; then
    echo "  ! Error asignando $vid: $resp"
  else
    echo "  + Asignado $vid"
  fi
done

echo
echo "── Creando un ticket de ejemplo (ocupa un espacio) ──"
FIRST_AVAILABLE_PLACE=""
for i in "${!PLACE_IDS[@]}"; do
  if [ "${PLACE_STATUS[$i]}" = "AVAILABLE" ]; then
    FIRST_AVAILABLE_PLACE="${PLACE_IDS[$i]}"
    break
  fi
done

if [ -n "$FIRST_AVAILABLE_PLACE" ] && [ "${#VEHICLE_PLATES[@]}" -gt 0 ]; then
  resp=$(auth_post "/api/tickets/tickets" "{\"idEspacio\":\"$FIRST_AVAILABLE_PLACE\",\"placa\":\"${VEHICLE_PLATES[0]}\"}")
  codigo=$(echo "$resp" | json_get "['codigo']")
  if [ -z "$codigo" ]; then
    echo "  ! Error creando ticket: $resp"
  else
    echo "  + Ticket $codigo creado (espacio $FIRST_AVAILABLE_PLACE ahora OCUPADO)"
  fi
fi

echo
echo "Listo — ${#ZONE_IDS[@]} zonas, ${#PLACE_IDS[@]} espacios, ${#VEHICLE_IDS[@]} vehículos."
