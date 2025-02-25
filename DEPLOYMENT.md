# Production Deployment Guide

This guide covers deploying the Express API Starter to a production environment.

## Prerequisites

- Docker and Docker Compose installed on the production server
- Node.js 20.x or later (for local development)
- A domain name and SSL certificate (recommended)
- Access to your production server via SSH

## Environment Setup

1. Create production environment file:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/data/db.sqlite
JWT_SECRET=your-secure-secret-here
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://your-frontend-domain.com
```

2. SSH Key Setup for GitHub Actions:
```bash
# On your production server
ssh-keygen -t rsa -b 4096 -C "deployment-key"
# Add the public key to authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
# Copy the private key to add to GitHub Secrets
cat ~/.ssh/id_rsa
```

## Server Setup

1. Install Docker and Docker Compose:
```bash
# Update package list
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. Set up project directory:
```bash
sudo mkdir -p /opt/express-api-starter
sudo chown $USER:$USER /opt/express-api-starter
cd /opt/express-api-starter
```

## Deployment Steps

### Manual Deployment

1. Clone the repository:
```bash
git clone https://github.com/yourusername/express-api-starter-ts.git .
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env with your production values
```

3. Start the application:
```bash
docker-compose up -d
```

### Automated Deployment with GitHub Actions

1. Add the following secrets to your GitHub repository:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Your Docker Hub access token
   - `SSH_HOST`: Your production server IP/hostname
   - `SSH_USERNAME`: SSH username
   - `SSH_PRIVATE_KEY`: The private key generated earlier

2. Push to main branch to trigger deployment:
```bash
git push origin main
```

## Monitoring and Maintenance

### Logs
```bash
# View logs
docker-compose logs -f api

# View specific container logs
docker-compose logs -f api redis prometheus grafana
```

### Database Backups
```bash
# Backup SQLite database
docker-compose exec api sh -c 'cd /data && tar czf /backup/db-$(date +%Y%m%d).tar.gz db.sqlite'
```

### Health Checks

Monitor the API health endpoint:
```bash
curl https://your-api-domain.com/api/health
```

### Scaling

To scale the API horizontally:
```bash
docker-compose up -d --scale api=3
```

## Rollback Procedure

If deployment fails:

1. Roll back to previous version:
```bash
# Get previous image tag
docker-compose pull
docker-compose up -d --no-deps api
```

2. Check logs for errors:
```bash
docker-compose logs -f api
```

## Security Considerations

1. Enable HTTPS using a reverse proxy (e.g., Nginx)
2. Keep Docker and system packages updated
3. Regularly rotate JWT secrets
4. Monitor system resources and logs
5. Set up automated backups
6. Configure firewall rules

## Troubleshooting

### Common Issues

1. Database connection errors:
   - Check volume permissions
   - Verify DATABASE_URL in environment

2. Container startup failures:
   - Check logs: `docker-compose logs api`
   - Verify environment variables

3. Performance issues:
   - Monitor resource usage
   - Check for memory leaks
   - Review database indexes

### Useful Commands

```bash
# Restart services
docker-compose restart

# View container status
docker-compose ps

# Check resource usage
docker stats

# Clean up unused resources
docker system prune
```