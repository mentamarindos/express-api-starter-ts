# Server Provisioning Guide

This guide covers the initial setup and provisioning of a production server for the Express API Starter.

## Server Requirements

- Ubuntu 22.04 LTS (recommended)
- Minimum 2 CPU cores
- 4GB RAM minimum (8GB recommended)
- 20GB SSD storage
- Static IP address
- Root access or sudo privileges

## Initial Server Setup

### Security Configuration

1. Update System:
```bash
apt update && apt upgrade -y
```

2. Create deployment user:
```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
```

3. Configure SSH:
```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Set these values
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH service
systemctl restart sshd
```

4. Set up firewall:
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### System Optimization

1. Adjust kernel parameters in `/etc/sysctl.conf`:
```
# Maximum number of open files
fs.file-max = 65535

# Network optimization
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.ip_local_port_range = 1024 65535

# Enable TCP Fast Open
net.ipv4.tcp_fastopen = 3
```

2. Configure system limits in `/etc/security/limits.conf`:
```
* soft nofile 65535
* hard nofile 65535
```

### Install Required Software

1. Install basic tools:
```bash
apt install -y curl git htop nginx certbot python3-certbot-nginx
```

2. Install Docker and Docker Compose:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add deploy user to docker group
usermod -aG docker deploy

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

## Nginx Setup

1. Create Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
    }
}
```

2. Setup SSL:
```bash
certbot --nginx -d your-domain.com
```

## Monitoring Setup

1. Install Node Exporter:
```bash
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/
```

2. Create Node Exporter service:
```bash
sudo tee /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

## Directory Structure

Create necessary directories:
```bash
mkdir -p /opt/express-api-starter/{app,data,backup,logs}
chown -R deploy:deploy /opt/express-api-starter
```

## Backup Configuration

1. Create backup script:
```bash
cat > /opt/express-api-starter/backup.sh <<EOF
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/express-api-starter/backup

# Backup database
cd /opt/express-api-starter/data
tar czf $BACKUP_DIR/db_$TIMESTAMP.tar.gz db.sqlite

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/express-api-starter/backup.sh
```

2. Set up daily cron job:
```bash
echo "0 0 * * * /opt/express-api-starter/backup.sh" | sudo tee -a /var/spool/cron/crontabs/deploy
```

## Log Rotation

Create logrotate configuration:
```bash
cat > /etc/logrotate.d/express-api <<EOF
/opt/express-api-starter/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
}
EOF
```

## Final Checks

1. Verify system settings:
```bash
sysctl -p
ulimit -n
```

2. Check Docker setup:
```bash
docker --version
docker-compose --version
docker info
```

3. Verify Nginx configuration:
```bash
nginx -t
```

4. Check SSL certificate:
```bash
certbot certificates
```

## Post-Installation

1. Set up monitoring alerts
2. Configure log aggregation
3. Set up automated backups
4. Document emergency contacts
5. Create incident response procedures

## Maintenance Procedures

1. Regular updates:
```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Clean up old images
docker system prune -af --volumes
```

2. Check system health:
```bash
# Disk space
df -h

# Memory usage
free -m

# System load
top -b -n 1

# Docker status
docker ps
docker stats
```