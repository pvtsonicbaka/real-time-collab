#!/bin/sh
# ─────────────────────────────────────────────────────────────
# Local k8s validation with minikube
# Usage: ./deploy-minikube.sh
# ─────────────────────────────────────────────────────────────
set -e

echo "▶ Starting minikube..."
minikube start --cpus=2 --memory=4096

echo "▶ Enabling ingress addon..."
minikube addons enable ingress
minikube addons enable metrics-server

echo "▶ Pointing Docker to minikube's daemon..."
eval $(minikube docker-env)

echo "▶ Building images inside minikube..."
docker build -t collabdocs-backend:latest ./apps/backend
docker build -t collabdocs-frontend:latest \
  --build-arg VITE_API_URL=http://collabdocs.local \
  ./apps/frontend

echo "▶ Applying manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml

echo "▶ Waiting for pods to be ready..."
kubectl rollout status deployment/redis   -n collabdocs
kubectl rollout status deployment/backend -n collabdocs
kubectl rollout status deployment/frontend -n collabdocs

echo ""
echo "✅ Done! Add this to /etc/hosts:"
echo "   $(minikube ip)  collabdocs.local"
echo ""
echo "Then open: http://collabdocs.local"
