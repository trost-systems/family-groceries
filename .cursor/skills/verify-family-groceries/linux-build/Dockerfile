# The Linux desktop toolchain `flutter build linux` needs, for hosts without it (see ../SKILL.md, Launch).
FROM ubuntu:24.04
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev libstdc++-14-dev \
    git curl unzip xz-utils ca-certificates file \
  && rm -rf /var/lib/apt/lists/*
