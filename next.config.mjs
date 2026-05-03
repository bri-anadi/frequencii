/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    silenceDeprecations: ["legacy-js-api"],
  },
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "node-localstorage": new URL("./src/lib/mock-node-localstorage.ts", import.meta.url).pathname,
        "node:path": "path-browserify",
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false, // will rely on path-browserify or node:path alias
        events: false,
      };

      // Add rule to handle node: scheme imports
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
    }
    config.ignoreWarnings = [
      { module: /node_modules\/web-worker\/cjs\/node\.js/ },
      { message: /the request of a dependency is an expression/ }
    ];
    return config;
  },
};

export default nextConfig;
