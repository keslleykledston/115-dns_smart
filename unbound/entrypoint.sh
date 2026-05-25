#!/bin/sh
set -e

echo "=== DNS Smart Server — Starting Unbound Setup ==="

# Keep the base config in sync even when /etc/unbound is backed by a named volume.
cp /opt/unbound-defaults/unbound.conf /etc/unbound/unbound.conf

# 1. Generate remote control certificates if they do not exist
if [ ! -f /etc/unbound/unbound_server.key ]; then
    echo "Remote control certificates not found. Generating..."
    unbound-control-setup -d /etc/unbound
    echo "Remote control certificates successfully generated."
else
    echo "Remote control certificates already exist. Skipping generation."
fi

# 2. Download/update root trust anchor for DNSSEC validation
echo "Updating DNSSEC root trust anchor..."
unbound-anchor -a /etc/unbound/root.key || echo "Warning: Root key update failed, using built-in fallback."

# 3. Create dummy include files if not present
[ -f /etc/unbound/local-records.conf ] || touch /etc/unbound/local-records.conf
[ -f /etc/unbound/blocklist.conf ] || touch /etc/unbound/blocklist.conf
[ -f /etc/unbound/forwarders.conf ] || touch /etc/unbound/forwarders.conf
[ -f /etc/unbound/unbound.log ] || touch /etc/unbound/unbound.log

# 4. Correct permissions for the 'unbound' user
echo "Fixing file permissions..."
chown -R unbound:unbound /etc/unbound
chmod 644 /etc/unbound/unbound.conf
chmod 666 /etc/unbound/local-records.conf
chmod 666 /etc/unbound/blocklist.conf
chmod 666 /etc/unbound/forwarders.conf
chmod 666 /etc/unbound/unbound.log

# 5. Start Unbound in foreground
echo "=== Starting Unbound DNS Resolver ==="
exec unbound -d -c /etc/unbound/unbound.conf
