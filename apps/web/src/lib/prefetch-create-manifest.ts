/** Lazy prefetch helpers — keep this file dependency-free so nav/layout can import it without pulling the create flow. */

export function prefetchCreateManifestStep() {
  void import("@/components/create-manifest-step");
}

export function prefetchCreateDelusionContent() {
  void import("@/components/create-delusion-content");
}
