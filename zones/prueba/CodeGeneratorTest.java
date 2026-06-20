import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Cliente interactivo para crear zonas y validar el generador de código
 * Se conecta a la API REST en http://localhost:8080/api/zones
 */
public class CodeGeneratorTest {

    private static final String API_URL = "http://localhost:8080/api/zones";
    private static final String[] TIPOS_ZONA = {"VIP", "REGULAR", "INTERNAL", "EXTERNAL", "PREFERENTIAL"};

    /**
     * Método principal - Interfaz interactiva
     */
    public static void main(String[] args) {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

        try {
            boolean continuar = true;

            while (continuar) {
                System.out.println("\nCREAR NUEVA ZONA:");
                System.out.println("-----------");

                // Pedir nombre
                System.out.print("Nombre de la zona: ");
                String nombre = reader.readLine().trim();

                if (nombre.isEmpty()) {
                    System.out.println("El nombre no puede estar vacío. Intenta de nuevo.");
                    continue;
                }

                // Pedir descripción
                System.out.print("Descripción (opcional): ");
                String descripcion = reader.readLine().trim();

                // Pedir tipo de zona
                System.out.println("Tipos de zona disponibles:");
                for (int i = 0; i < TIPOS_ZONA.length; i++) {
                    System.out.println("  " + (i + 1) + ". " + TIPOS_ZONA[i]);
                }
                System.out.print("Selecciona el número del tipo: ");
                String tipoInput = reader.readLine().trim();

                int tipoIndex;
                try {
                    tipoIndex = Integer.parseInt(tipoInput) - 1;
                    if (tipoIndex < 0 || tipoIndex >= TIPOS_ZONA.length) {
                        System.out.println("Opción inválida. Intenta de nuevo.");
                        continue;
                    }
                } catch (NumberFormatException e) {
                    System.out.println("Debes ingresar un número válido.");
                    continue;
                }

                String tipo = TIPOS_ZONA[tipoIndex];

                // Crear JSON y enviar
                String jsonPayload = crearJsonPayload(nombre, descripcion, tipo);
                System.out.println("\nEnviando solicitud a la API...");
                boolean zonaCreada = crearZona(jsonPayload);

                if (zonaCreada) {
                    System.out.println("Zona creada exitosamente");
                } else {
                    System.out.println("Error al crear la zona. Verifica que la API esté corriendo.");
                }

                // Preguntar si desea crear otra
                System.out.print("\n¿Deseas crear otra zona? (s/n): ");
                String opcion = reader.readLine().trim().toLowerCase();
                continuar = opcion.equals("s") || opcion.equals("si");
            }
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Crea el payload JSON para la solicitud POST
     */
    private static String crearJsonPayload(String nombre, String descripcion, String tipo) {
        String desc = descripcion.isEmpty() ? "" : descripcion;
        return String.format(
            "{\"name\": \"%s\", \"description\": \"%s\", \"type\": \"%s\"}",
            nombre, desc, tipo
        );
    }

    /**
     * Envía la solicitud POST a la API
     */
    private static boolean crearZona(String jsonPayload) {
        try {
            URL url = URI.create(API_URL).toURL();
            HttpURLConnection conexion = (HttpURLConnection) url.openConnection();

            conexion.setRequestMethod("POST");
            conexion.setRequestProperty("Content-Type", "application/json");
            conexion.setDoOutput(true);
            conexion.setConnectTimeout(5000);
            conexion.setReadTimeout(5000);

            // Enviar payload
            try (var os = conexion.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            // Obtener respuesta
            int responseCode = conexion.getResponseCode();

            if (responseCode == 201 || responseCode == 200) {
                return true;
            } else {
                System.out.println("Error HTTP: " + responseCode);
                return false;
            }

        } catch (Exception e) {
            System.out.println("Error de conexión: " + e.getMessage());
            return false;
        }
    }
}
