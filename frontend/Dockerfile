# ─────────────────────────────────────────────────────────────────────────────
# frontend/Dockerfile  — A-P7-04
# Multi-stage: Node.js build stage → Nginx static file server.
# Serves the Vite production build via nginx on port 80.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — build the React/Vite app
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
# Use ci for reproducible, lock-file-locked installs
RUN npm ci

COPY . .
# VITE_API_BASE_URL must be set at build time (passed as --build-arg or in compose)
ARG VITE_API_BASE_URL=http://localhost:8000/api/
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_LIVEKIT_URL
ENV VITE_LIVEKIT_URL=${VITE_LIVEKIT_URL}
RUN npm run build


# Stage 2 — serve with nginx
FROM nginx:1.27-alpine AS runtime

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: serve index.html for all routes (required for React Router)
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    # API reverse proxy — requests to /api/ are forwarded to the backend service\n\
    location /api/ {\n\
        proxy_pass http://backend:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
    # React Router: serve index.html for all non-asset routes\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    # Cache static assets aggressively\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
