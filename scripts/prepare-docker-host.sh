#!/usr/bin/env bash
# ==============================================================================
# DNS Smart Server — Docker Host Preparation Script
# Idempotent script to install, validate, and repair Docker on Ubuntu/Debian hosts
# ==============================================================================

set -euo pipefail

log() {
  echo -e "\033[1;34m[prepare-docker]\033[0m $*"
}

success() {
  echo -e "\033[1;32m[prepare-docker][SUCCESS]\033[0m $*"
}

warn() {
  echo -e "\033[1;33m[prepare-docker][WARNING]\033[0m $*"
}

fail() {
  echo -e "\033[1;31m[prepare-docker][ERROR]\033[0m $*" >&2
  exit 1
}

# Parse Arguments
ADD_USER=false
for arg in "$@"; do
  case $arg in
    --add-current-user)
      ADD_USER=true
      shift
      ;;
    *)
      # Ignore unknown arguments or handle custom help
      echo "Uso: $0 [--add-current-user]"
      exit 0
      ;;
  esac
done

echo "=== DNS Smart — Docker Environment Preparation ==="

# 1. Detect if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found. Installing Docker using the official script..."
  curl -fsSL https://get.docker.com | sudo sh
  success "Docker successfully installed!"
else
  log "Docker is already installed: $(docker --version || true)"
fi

# 2. Ensure containerd service is enabled and started
log "Ensuring containerd service is enabled and active..."
sudo systemctl enable --now containerd || fail "Failed to enable/start containerd"

# 3. Clean any active failed states for docker.service and docker.socket
log "Cleaning Docker failed state registers..."
sudo systemctl reset-failed docker.service docker.socket || true

# 4. Ensure docker.socket is enabled and active
log "Ensuring docker.socket is enabled and active..."
sudo systemctl enable --now docker.socket || fail "Failed to enable/start docker.socket"

# 5. Restart containerd to clear active handles
log "Restarting containerd..."
sudo systemctl restart containerd || fail "Failed to restart containerd"

# 6. Start/Restart Docker daemon
log "Starting Docker daemon..."
sudo systemctl start docker.service || {
  warn "Start command failed. Attempting to restart docker.service..."
  sudo systemctl restart docker.service || fail "Failed to start/restart docker.service"
}

# 7. Validate Docker socket availability and daemon responsiveness
log "Validating Docker responsiveness..."
sudo docker ps >/dev/null || fail "Docker installed, but the daemon is not responding to requests via socket!"

success "Docker service is fully operational!"

# 8. Optional: Add current user to 'docker' group
if [ "$ADD_USER" = true ]; then
  CURRENT_USER="${USER:-$(whoami)}"
  log "Adding current user '$CURRENT_USER' to the 'docker' group..."
  if getent group docker >/dev/null; then
    sudo usermod -aG docker "$CURRENT_USER"
    success "User '$CURRENT_USER' successfully added to the 'docker' group."
    warn "To apply group changes, log out and log back in, or run the following command in your terminal:"
    echo -e "      \033[1;36mnewgrp docker\033[0m"
  else
    fail "Group 'docker' does not exist. Please ensure Docker group was created during installation."
  fi
fi

# 9. Print final status details
log "Final status of docker.socket:"
sudo systemctl status docker.socket --no-pager -l || true

log "Final status of docker.service:"
sudo systemctl status docker.service --no-pager -l || true

success "Docker environment preparation completed successfully! All systems OK."
