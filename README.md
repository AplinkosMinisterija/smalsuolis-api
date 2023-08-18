# BĮIP Rūšys API
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/AplinkosMinisterija/biip-rusys-api/badge)](https://securityscorecards.dev/viewer/?platform=github.com&org={AplinkosMinisterija}&repo={biip-rusys-api})
[![License](https://img.shields.io/github/license/AplinkosMinisterija/biip-rusys-api)](https://github.com/AplinkosMinisterija/biip-rusys-api/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/AplinkosMinisterija/biip-rusys-api)](https://github.com/AplinkosMinisterija/biip-rusys-api/issues)
[![GitHub stars](https://img.shields.io/github/stars/AplinkosMinisterija/biip-rusys-api)](https://github.com/AplinkosMinisterija/biip-rusys-api/stargazers)

This repository contains the source code and documentation for the BĮIP Rūšys API, developed by the Aplinkos
Ministerija.
## Table of Contents

- [About the Project](#about-the-project)
- [Getting Started](#getting-started)
    - [Installation](#installation)
    - [Usage](#usage)
- [OpenAPI](#openapi)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)


## About the Project

The BĮIP Rūšys API is designed to provide information and functionalities related to activities of different water bodies located in Lithuania. It aims to support the management of water bodies.

## Getting Started

To get started with the BĮIP Rūšys API, follow the instructions below.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/AplinkosMinisterija/biip-rusys-api.git
   ```

2. Install the required dependencies:

   ```bash
   cd biip-rusys-api
   yarn install
   ```

### Usage
1. Set up the required environment variables. Copy the `.env.example` file to `.env` and provide the necessary values for the variables.

2. Start the API server:

   ```bash
   yarn dc:up
   yarn dev
   ```

The API will be available at `http://localhost:3000/rusys`.

## Deployment

### Production

To deploy the application to the production environment, create a new GitHub release:

1. Go to the repository's main page on GitHub.
2. Click on the "Releases" tab.
3. Click on the "Create a new release" button.
4. Provide a version number, such as `1.2.3`, and other relevant information.
5. Click on the "Publish release" button.

### Staging

The `main` branch of the repository is automatically deployed to the staging environment. Any changes pushed to the main
branch will trigger a new deployment.

### Development

To deploy any branch to the development environment use the `Deploy to Development` GitHub action.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a
pull request. For more information, see the [contribution guidelines](./CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](./LICENSE).
