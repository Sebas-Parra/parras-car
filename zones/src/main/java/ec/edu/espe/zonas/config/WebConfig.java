package ec.edu.espe.zonas.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new CaseInsensitiveEnumConverterFactory());
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static final class CaseInsensitiveEnumConverterFactory
            implements ConverterFactory<String, Enum<?>> {

        @Override
        public <T extends Enum<?>> Converter<String, T> getConverter(Class<T> targetType) {
            return source -> (T) Enum.valueOf((Class<Enum>) targetType, source.trim().toUpperCase());
        }
    }
}
