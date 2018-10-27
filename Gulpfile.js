"use strict";

const plumber = require("gulp-plumber");
const through = require("through2");
const chalk = require("chalk");
const newer = require("gulp-newer");
const babel = require("gulp-babel");
const gulpWatch = require("gulp-watch");
const gutil = require("gulp-util");
const filter = require("gulp-filter");
const gulp = require("gulp");
const path = require("path");
const merge = require("merge-stream");
const rollup = require("rollup-stream");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const rollupBabel = require("rollup-plugin-babel");
const rollupNodeResolve = require("rollup-plugin-node-resolve");

const sources = ["codemods", "packages"];

function swapSrcWithLib(srcPath) {
  const parts = srcPath.split(path.sep);
  parts[1] = "lib";
  return parts.join(path.sep);
}

function getGlobFromSource(source) {
  return `./${source}/*/src/**/*.js`;
}

function getIndexFromPackage(name) {
  return `${name}/src/index.js`;
}

function compilationLogger(rollup) {
  return through.obj(function(file, enc, callback) {
    gutil.log(
      `Compiling '${chalk.cyan(file.relative)}'${
        rollup ? " with rollup " : ""
      }...`
    );
    callback(null, file);
  });
}

function errorsLogger() {
  return plumber({
    errorHandler(err) {
      gutil.log(err.stack);
    },
  });
}

function rename(fn) {
  return through.obj(function(file, enc, callback) {
    file.path = fn(file);
    callback(null, file);
  });
}

function buildBabel(exclude) {
  return merge(
    sources.map(source => {
      const base = path.join(__dirname, source);
      let stream = gulp.src(getGlobFromSource(source), { base: base });

      if (exclude) {
        const filters = exclude.map(p => `!**/${p}/**`);
        filters.unshift("**");
        stream = stream.pipe(filter(filters));
      }

      return stream
        .pipe(errorsLogger())
        .pipe(newer({ dest: base, map: swapSrcWithLib }))
        .pipe(compilationLogger())
        .pipe(babel())
        .pipe(
          // Passing 'file.relative' because newer() above uses a relative
          // path and this keeps it consistent.
          rename(file => path.resolve(file.base, swapSrcWithLib(file.relative)))
        )
        .pipe(gulp.dest(base));
    })
  );
}

function buildRollup(packages) {
  return merge(
    packages.map(pkg => {
      // Matt Browne added (just for this branch)
      // since build output might make it look like it's skipping babel-parser
      gutil.log(`Starting to compile "${chalk.cyan(pkg)}" with rollup...`);
      return rollup({
        input: getIndexFromPackage(pkg),
        format: "cjs",
        plugins: [
          rollupBabel({
            envName: "babel-parser",
          }),
          rollupNodeResolve(),
        ],
      })
        .pipe(source("index.js"))
        .pipe(buffer())
        .pipe(errorsLogger())
        .pipe(compilationLogger(/* rollup */ true))
        .pipe(gulp.dest(path.join(pkg, "lib")));
    })
  );
}

gulp.task("build", function() {
  const bundles = ["packages/babel-parser"];
  // return merge([buildBabel(/* exclude */ bundles)]);
  return merge([buildBabel(/* exclude */ bundles), buildRollup(bundles)]);
});

gulp.task("default", gulp.series("build"));

gulp.task("build-no-bundle", () => buildBabel());

gulp.task(
  "watch",
  gulp.series("build-no-bundle", function watch() {
    gulpWatch(
      sources.map(getGlobFromSource),
      { debounceDelay: 200 },
      gulp.task("build-no-bundle")
    );
  })
);
