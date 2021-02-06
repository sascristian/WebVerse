declare const _default: "#include <common>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nvarying float vViewZ;\nvarying vec4 vProjTexCoord;\n\nvoid main() {\n\n\t#include <skinbase_vertex>\n\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\n\tvViewZ = mvPosition.z;\n\tvProjTexCoord = gl_Position;\n\n\t#include <clipping_planes_vertex>\n\n}\n";
export default _default;
