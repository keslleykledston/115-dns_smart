FROM alpine:3.19

# Install Unbound and OpenSSL (required for generating certificates)
RUN apk add --no-cache unbound openssl

# Create necessary directories and configure permissions
RUN mkdir -p /etc/unbound && \
    mkdir -p /opt/unbound-defaults && \
    touch /etc/unbound/unbound.log && \
    chown -R unbound:unbound /etc/unbound

# Copy our custom configuration and initial files
COPY unbound.conf /etc/unbound/unbound.conf
COPY unbound.conf /opt/unbound-defaults/unbound.conf
COPY local-records.conf /etc/unbound/local-records.conf
COPY blocklist.conf /etc/unbound/blocklist.conf
COPY forwarders.conf /etc/unbound/forwarders.conf

RUN chown -R unbound:unbound /etc/unbound

# Copy and setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose standard DNS ports, remote control port
EXPOSE 53/udp 53/tcp 8953/tcp

ENTRYPOINT ["/entrypoint.sh"]
