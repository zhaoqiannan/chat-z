pipeline {
    agent { label 'builder' }
    environment {
        REGISTRY = 'registry.youjivest.com'
        APP_CREDS = credentials('app-deploy-token')
    }
    stages {
        stage('build') {
            when {
                allOf {
                    expression { GITLAB_OBJECT_KIND ==~ /(push|tag_push|merge_request)/ }
                    expression { ! (BRANCH_NAME =~ /\//) }
                }
            }
            options { retry(3) }
            steps {
                sh 'podman build -t ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${BRANCH_NAME} -f Containerfile .'
            }
        }
        stage('test') {
            steps {
                echo 'test'
            }
        }
        stage('deploy') {
            when {
                allOf {
                    expression { GITLAB_OBJECT_KIND ==~ /(push|tag_push|merge_request)/ }
                    expression { ! (BRANCH_NAME =~ /\//) }
                }
            }
            stages {
                stage('podman push branch_name') {
                    steps {
                        sh 'podman push --creds ${APP_CREDS_USR}:${APP_CREDS_PSW} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${BRANCH_NAME} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${BRANCH_NAME}'
                    }
                }
                stage('podman push latest') {
                    when { environment name: 'BRANCH_NAME', value: env.GITLAB_PROJECT_DEFAULT_BRANCH }
                    steps {
                        sh 'podman push --creds ${APP_CREDS_USR}:${APP_CREDS_PSW} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${BRANCH_NAME} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:latest'
                    }
                }
                stage('podman push tag_name') {
                    when { environment name: 'GITLAB_OBJECT_KIND', value: 'tag_push' }
                    steps {
                        sh 'podman push --creds ${APP_CREDS_USR}:${APP_CREDS_PSW} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${BRANCH_NAME} ${REGISTRY}/${GITLAB_PROJECT_PATH_NAMESPACE}:${TAG_NAME}'
                    }
                }
            }
        }
    }
    post {
        failure {
            emailext body: '$DEFAULT_CONTENT', recipientProviders:  [buildUser(), contributor(), developers(), requestor(), upstreamDevelopers()], subject: '$DEFAULT_SUBJECT'
        }
    }
}
