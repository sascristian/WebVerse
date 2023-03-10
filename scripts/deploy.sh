set -x

STAGE=$1
TAG=$2

kubectl delete job $STAGE-xrengine-testbot

helm upgrade --reuse-values --set taskserver.image.repository=$ECR_URL/$REPO_NAME-taskserver,taskserver.image.tag=$TAG,api.image.repository=$ECR_URL/$REPO_NAME-api,api.image.tag=$TAG,instanceserver.image.repository=$ECR_URL/$REPO_NAME-instanceserver,instanceserver.image.tag=$TAG,testbot.image.repository=$ECR_URL/$REPO_NAME-testbot,testbot.image.tag=$TAG,client.image.repository=$ECR_URL/$REPO_NAME-client,client.image.tag=$TAG $STAGE xrengine/xrengine
