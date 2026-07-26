package ec.edu.espe.zonas.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new CaseInsensitiveEnumConverterFactory());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // El navegador adjunta el header Origin incluso en requests same-origin
        // para métodos no-GET (POST/PUT/PATCH/DELETE) — sin permitir esos
        // métodos acá, Spring corta la request con "Invalid CORS request"
        // antes de llegar a la capa de autorización por rol (SecurityConfig).
        // La restricción de QUIÉN puede escribir sigue siendo responsabilidad
        // de SecurityConfig (hasAnyRole/hasRole), no de esta config CORS.
        registry.addMapping("/api/v1/**")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedOriginPatterns("*");
    }

    private static final class CaseInsensitiveEnumConverterFactory
            implements ConverterFactory<String, Enum<?>> {

        @Override
        @SuppressWarnings({"unchecked", "rawtypes"})
        public <T extends Enum<?>> Converter<String, T> getConverter(Class<T> targetType) {
            Class rawType = targetType;
            return source -> (T) Enum.valueOf(rawType, source.trim().toUpperCase());
        }
    }
}
