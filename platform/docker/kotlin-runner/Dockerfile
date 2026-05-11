FROM eclipse-temurin:17-jdk-jammy

ARG KOTLIN_VERSION=1.9.25

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/kotlin.zip \
      https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip \
    && unzip -q /tmp/kotlin.zip -d /opt \
    && rm /tmp/kotlin.zip \
    && ln -s /opt/kotlinc/bin/kotlinc /usr/local/bin/kotlinc \
    && ln -s /opt/kotlinc/bin/kotlin /usr/local/bin/kotlin

# coreutils provides the `timeout` binary used by the run harness
RUN apt-get update \
    && apt-get install -y --no-install-recommends coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
CMD ["tail", "-f", "/dev/null"]
