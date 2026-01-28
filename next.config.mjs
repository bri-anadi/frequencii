/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    silenceDeprecations: ["legacy-js-api"],
  },
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
    return config;
  },
};

export default nextConfig;
