package ec.edu.espe.zonas.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class ClientIpTest {

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void prefersTheFirstXForwardedForValueOverTheRawRemoteAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.1");
        request.setRemoteAddr("172.18.0.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("203.0.113.5");
    }

    @Test
    void fallsBackToTheRawRemoteAddressWhenNoForwardedHeaderIsPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("172.18.0.7");
    }

    @Test
    void stripsTheIpv4MappedIpv6Prefix() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("::ffff:127.0.0.1");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("127.0.0.1");
    }
}
