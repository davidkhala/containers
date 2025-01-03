wait-until-healthy(){
  
  local CONTAINER_NAME=$1

  # Loop until the container is healthy
  while true; do
      HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME")
  
      if [[ "$HEALTH_STATUS" == "healthy" ]]; then
          echo "Container $CONTAINER_NAME is healthy!"
          break
      elif [[ "$HEALTH_STATUS" == "unhealthy" ]]; then
          echo "Container $CONTAINER_NAME is unhealthy!"
          exit 1
      else
          echo "Current health status: $HEALTH_STATUS. Waiting..."
      fi
  done
}
"$@"
