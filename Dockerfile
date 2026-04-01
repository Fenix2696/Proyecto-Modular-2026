# Etapa de build
FROM gradle:8.4-jdk17 AS build
WORKDIR /app

# Copiar todo el proyecto
COPY . .

# Construir el proyecto
RUN gradle build -x test

# Etapa de ejecución
FROM openjdk:17-jdk-slim
WORKDIR /app

# Copiar el jar generado
COPY --from=build /app/build/libs/*.jar app.jar

# Exponer puerto
EXPOSE 8080

# Ejecutar app
CMD ["java", "-jar", "app.jar"]