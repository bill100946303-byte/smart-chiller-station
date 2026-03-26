import os
import sys

import bpy


def load_image(image_path, colorspace):
    if not image_path or not os.path.exists(image_path):
        return None

    image = bpy.data.images.load(image_path, check_existing=True)
    image.colorspace_settings.name = colorspace
    return image


def pick_texture(texture_dir, keywords):
    candidates = []
    for entry in os.listdir(texture_dir):
        full_path = os.path.join(texture_dir, entry)
        if not os.path.isfile(full_path):
            continue
        lowered = entry.lower()
        if not lowered.endswith((".tga", ".png", ".jpg", ".jpeg", ".webp")):
            continue
        if any(keyword in lowered for keyword in keywords):
            candidates.append(full_path)

    candidates.sort()
    return candidates[0] if candidates else None


def apply_pbr_materials(texture_dir):
    albedo = load_image(pick_texture(texture_dir, ["albedo", "basecolor", "base_color", "diffuse", "color"]), "sRGB")
    ao = load_image(pick_texture(texture_dir, ["_ao", "ambientocclusion", "occlusion"]), "Non-Color")
    metallic = load_image(pick_texture(texture_dir, ["metalness", "metallic"]), "Non-Color")
    roughness = load_image(pick_texture(texture_dir, ["roughness", "rough"]), "Non-Color")
    mixmap = load_image(pick_texture(texture_dir, ["mixmap", "metallicroughness", "orm"]), "Non-Color")
    normal = load_image(pick_texture(texture_dir, ["normal"]), "Non-Color")

    for material in bpy.data.materials:
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        nodes.clear()

        output = nodes.new(type="ShaderNodeOutputMaterial")
        output.location = (900, 0)
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        bsdf.location = (520, 0)
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

        if albedo:
            base_node = nodes.new(type="ShaderNodeTexImage")
            base_node.image = albedo
            base_node.location = (-660, 120)

            if ao:
                ao_node = nodes.new(type="ShaderNodeTexImage")
                ao_node.image = ao
                ao_node.location = (-660, -40)

                multiply = nodes.new(type="ShaderNodeMixRGB")
                multiply.blend_type = "MULTIPLY"
                multiply.inputs["Fac"].default_value = 1.0
                multiply.location = (-180, 60)
                links.new(base_node.outputs["Color"], multiply.inputs["Color1"])
                links.new(ao_node.outputs["Color"], multiply.inputs["Color2"])
                links.new(multiply.outputs["Color"], bsdf.inputs["Base Color"])
            else:
                links.new(base_node.outputs["Color"], bsdf.inputs["Base Color"])

        if metallic:
            metallic_node = nodes.new(type="ShaderNodeTexImage")
            metallic_node.image = metallic
            metallic_node.location = (-660, -220)
            metallic_split = nodes.new(type="ShaderNodeSeparateColor")
            metallic_split.location = (-360, -220)
            links.new(metallic_node.outputs["Color"], metallic_split.inputs["Color"])
            links.new(metallic_split.outputs["Red"], bsdf.inputs["Metallic"])

        if roughness:
            roughness_node = nodes.new(type="ShaderNodeTexImage")
            roughness_node.image = roughness
            roughness_node.location = (-660, -420)
            roughness_split = nodes.new(type="ShaderNodeSeparateColor")
            roughness_split.location = (-360, -420)
            links.new(roughness_node.outputs["Color"], roughness_split.inputs["Color"])
            links.new(roughness_split.outputs["Red"], bsdf.inputs["Roughness"])

        if mixmap:
            mixmap_node = nodes.new(type="ShaderNodeTexImage")
            mixmap_node.image = mixmap
            mixmap_node.location = (-660, -320)
            mixmap_split = nodes.new(type="ShaderNodeSeparateColor")
            mixmap_split.location = (-360, -320)
            links.new(mixmap_node.outputs["Color"], mixmap_split.inputs["Color"])
            if not metallic:
                links.new(mixmap_split.outputs["Blue"], bsdf.inputs["Metallic"])
            if not roughness:
                links.new(mixmap_split.outputs["Green"], bsdf.inputs["Roughness"])

        if normal:
            normal_node = nodes.new(type="ShaderNodeTexImage")
            normal_node.image = normal
            normal_node.location = (-660, -620)
            normal_map = nodes.new(type="ShaderNodeNormalMap")
            normal_map.location = (-180, -620)
            links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
            links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])


def main():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("Usage: blender --background --python blender-fbx-to-glb.py -- <input.fbx> <output.glb>")

    input_path, output_path = argv[argv.index("--") + 1 : argv.index("--") + 3]
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)

    if not os.path.exists(input_path):
        raise SystemExit(f"Input FBX not found: {input_path}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=input_path)
    apply_pbr_materials(os.path.dirname(input_path))

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        use_selection=False,
    )

    print(f"[blender-fbx-to-glb] exported: {output_path}")


if __name__ == "__main__":
    main()
