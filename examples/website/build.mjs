import { context } from "esbuild";
import { copy } from "esbuild-plugin-copy";

let ctx = await context({
    entryPoints: ["src/app.ts"],
    bundle: true,
    outdir: "build/src",
    logLevel: "info",
    sourcemap: "inline",
    plugins: [
        copy({
            // this is equal to process.cwd(), which means we use cwd path as base path to resolve `to` path
            // if not specified, this plugin uses ESBuild.build outdir/outfile options as base path.
            resolveFrom: "cwd",
            assets: {
                from: ["./index.html"],
                to: ["build/index.html"],
            },
            watch: true,
        }),
    ],
});

if (process.env.NODE_ENV !== "dev") {
    // minify in production
    await ctx.rebuild({
        minify: true,
    });
} else {
    await ctx.watch();

    await ctx.serve({
        servedir: "build",
    });
}
