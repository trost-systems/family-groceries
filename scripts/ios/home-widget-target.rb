# frozen_string_literal: true

# Adds the WidgetKit extension HomeWidget (app/ios/HomeWidget/, docs/HOME_WIDGETS.md) to
# app/ios/Runner.xcodeproj and embeds it in Runner. Idempotent: a rerun changes nothing, and a new
# .swift file in HomeWidget/ joins the target on the next run. From app/:
#
#   bundle exec ruby ../scripts/ios/home-widget-target.rb
require "xcodeproj"

IOS_DIR = File.expand_path("../../app/ios", __dir__)
NAME = "HomeWidget"
EMBED_PHASE = "Embed Foundation Extensions"

project = Xcodeproj::Project.open(File.join(IOS_DIR, "Runner.xcodeproj"))
runner = project.targets.find { |t| t.name == "Runner" } or abort("no Runner target")

group = project.main_group.children.find { |c| c.display_name == NAME } ||
        project.main_group.new_group(NAME, NAME)

def file_ref(group, name)
  ref = group.files.find { |f| f.path == name } || group.new_reference(name)
  ref.last_known_file_type = "text.json.xcstrings" if name.end_with?(".xcstrings")
  ref
end

def ensure_in(phase, ref)
  phase.files_references.include?(ref) ? phase.files.find { |f| f.file_ref == ref } : phase.add_file_reference(ref)
end

target = project.targets.find { |t| t.name == NAME }
unless target
  target = project.new(Xcodeproj::Project::Object::PBXNativeTarget)
  project.targets << target
  target.name = NAME
  target.product_name = NAME
  target.product_type = Xcodeproj::Constants::PRODUCT_TYPE_UTI[:app_extension]
  product = project.products_group.new_reference("#{NAME}.appex", :built_products)
  product.explicit_file_type = "wrapper.app-extension"
  product.last_known_file_type = nil
  product.include_in_index = "0"
  target.product_reference = product
  target.build_configuration_list = project.new(Xcodeproj::Project::Object::XCConfigurationList)
  target.build_configuration_list.default_configuration_is_visible = "0"
  target.build_configuration_list.default_configuration_name = "Release"
  target.build_phases << project.new(Xcodeproj::Project::Object::PBXSourcesBuildPhase)
  target.build_phases << project.new(Xcodeproj::Project::Object::PBXFrameworksBuildPhase)
  target.build_phases << project.new(Xcodeproj::Project::Object::PBXResourcesBuildPhase)
end

# Flutter's xcconfigs carry FLUTTER_BUILD_NAME and FLUTTER_BUILD_NUMBER, which Info.plist uses so
# the extension's version always matches the app's (App Store validation requires it).
xcconfigs = project.files.select { |f| %w[Debug.xcconfig Release.xcconfig].include?(f.display_name) }
                  .to_h { |f| [f.display_name, f] }
project.build_configurations.map(&:name).each do |config_name|
  config = target.build_configuration_list[config_name] ||
           project.new(Xcodeproj::Project::Object::XCBuildConfiguration).tap do |c|
             c.name = config_name
             target.build_configuration_list.build_configurations << c
           end
  debug = config_name == "Debug"
  config.base_configuration_reference = xcconfigs.fetch(debug ? "Debug.xcconfig" : "Release.xcconfig")
  config.build_settings = {
    "CODE_SIGN_ENTITLEMENTS" => "#{NAME}/#{NAME}.entitlements",
    "CODE_SIGN_STYLE" => "Automatic",
    "CURRENT_PROJECT_VERSION" => "$(FLUTTER_BUILD_NUMBER)",
    "INFOPLIST_FILE" => "#{NAME}/Info.plist",
    "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
    "LD_RUNPATH_SEARCH_PATHS" => ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"],
    "MARKETING_VERSION" => "$(FLUTTER_BUILD_NAME)",
    "PRODUCT_BUNDLE_IDENTIFIER" => "com.hummlist.app.#{NAME}",
    "PRODUCT_NAME" => "$(TARGET_NAME)",
    "SKIP_INSTALL" => "YES",
    "SWIFT_EMIT_LOC_STRINGS" => "YES",
    "SWIFT_VERSION" => "5.0",
    "TARGETED_DEVICE_FAMILY" => "1,2"
  }.merge(debug ? { "SWIFT_ACTIVE_COMPILATION_CONDITIONS" => "DEBUG", "SWIFT_OPTIMIZATION_LEVEL" => "-Onone" } : {})
end

Dir.children(File.join(IOS_DIR, NAME)).sort.each do |name|
  next unless name.end_with?(".swift", ".xcstrings", ".plist", ".entitlements")

  ref = file_ref(group, name)
  ensure_in(target.source_build_phase, ref) if name.end_with?(".swift")
  ensure_in(target.resources_build_phase, ref) if name.end_with?(".xcstrings")
end
# SDK-relative, as Xcode adds them; xcodeproj's add_system_frameworks pins the SDK version.
frameworks = project.frameworks_group
%w[WidgetKit SwiftUI].each do |framework|
  path = "System/Library/Frameworks/#{framework}.framework"
  ref = frameworks.files.find { |f| f.path == path } || frameworks.new_reference(path, :sdk_root)
  ensure_in(target.frameworks_build_phase, ref)
end

runner.add_dependency(target) unless runner.dependencies.any? { |d| d.target == target }

embed = runner.copy_files_build_phases.find { |p| p.name == EMBED_PHASE } ||
        runner.new_copy_files_build_phase(EMBED_PHASE)
embed.dst_path = ""
embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:plug_ins]
ensure_in(embed, target.product_reference).settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
# Embedding after Flutter's Thin Binary script makes Xcode report "Cycle inside Runner".
runner.build_phases.delete(embed)
thin = runner.build_phases.index { |p| p.display_name == "Thin Binary" } or abort("no Thin Binary phase in Runner")
runner.build_phases.insert(thin, embed)

project.save
# xcodeproj names the Swift package by its display name; keep the comment Xcode and Flutter write.
pbxproj = File.join(IOS_DIR, "Runner.xcodeproj/project.pbxproj")
File.write(pbxproj, File.read(pbxproj).gsub(
  'XCLocalSwiftPackageReference "FlutterGeneratedPluginSwiftPackage"',
  'XCLocalSwiftPackageReference "Flutter/ephemeral/Packages/FlutterGeneratedPluginSwiftPackage"'
))
