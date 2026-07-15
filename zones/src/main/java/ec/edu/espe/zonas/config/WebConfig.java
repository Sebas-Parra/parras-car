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
        // Dashboard de monitoreo de espacios (estático, se abre desde file:// o
        // un puerto distinto) — solo necesita leer /api/v1/places.
        registry.addMapping("/api/v1/places/**")
                .allowedMethods("GET")
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
