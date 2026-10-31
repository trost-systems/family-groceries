# App icon requirements on Apple and Google platforms (October 2026)

Research for job 45, the Hummlist app icon. Every claim below links to an official page that was fetched on 2026-10-31. Points that no official page confirmed are listed in [Could not confirm from an official source](#could-not-confirm-from-an-official-source).

## Spec table

| | iOS, iPadOS, macOS | watchOS | visionOS | Android launcher (adaptive icon) | Google Play listing |
| --- | --- | --- | --- | --- | --- |
| Source file | Icon Composer `.icon` file, or a flat bitmap ([HIG][hig]) | Same `.icon` file ([Xcode doc][ic-doc]) | Image stack in the asset catalog ([asset catalog doc][cfg]) | `<adaptive-icon>` XML in `res/mipmap-anydpi-v26/` ([adaptive][adaptive]) | One uploaded image ([Play spec][play]) |
| Layers | 1 background plus foreground layers, organized into at most 4 groups ([Xcode doc][ic-doc]) | Same as iOS | 1 background plus 1 or 2 foreground layers, 3 at most ([HIG][hig], [asset catalog doc][cfg]) | Foreground, background, optional monochrome ([adaptive][adaptive]) | 1 flat image |
| Canvas | 1024 x 1024 px ([HIG][hig]) | 1088 x 1088 px ([HIG][hig]) | 1024 x 1024 px per layer ([WWDC23][w23]) | 108 x 108 dp per layer ([adaptive][adaptive]) | 512 x 512 px ([Play spec][play]) |
| Mask after rendering | Rounded rectangle ([HIG][hig]) | Circle ([HIG][hig]) | Circle ([HIG][hig]) | Set by the OEM, or by the user on Android 16 QPR2 ([adaptive][adaptive], [QPR2 notes][qpr2rn]) | Rounded square, radius 30% of the icon size ([Play spec][play]) |
| Safe area | Keep primary content centered, use the template grid ([HIG][hig]) | Same, with extra care for the circle ([HIG][hig]) | Keep graphics centered ([HIG][hig], [WWDC23][w23]) | Inner 66 x 66 dp is never clipped. Inner 72 x 72 dp shows in the viewport. Outer 18 dp per side is for masks and motion ([adaptive][adaptive], [AdaptiveIconDrawable][aid]) | Keyline grid, used as a guide ([Play spec][play]) |
| Layer formats | SVG preferred, PNG for raster art and mesh gradients ([HIG][hig], [Xcode doc][ic-doc]) | Same | Images in the asset catalog. Format not stated (see the unconfirmed list) | Vector drawable preferred, bitmaps allowed ([adaptive][adaptive]) | 32-bit PNG, sRGB, at most 1024 KB ([Play spec][play]) |
| Appearances | Default, dark, clear light, clear dark, tinted light, tinted dark ([HIG][hig]) | None ([HIG][hig], [Xcode doc][ic-doc]) | None ([HIG][hig]) | Full colour, plus a themed tint from the monochrome layer on Android 13+ ([Android 13][a13]) | None |
| Effects added by the system | Specular highlights, refraction, translucency, blur, shadow ([HIG][hig], [Xcode doc][ic-doc]) | Same material | Specular highlights, shadows between layers, emboss from the upper layers' alpha ([HIG][hig]) | Launcher-generated motion such as parallax or pulsing ([adaptive][adaptive], [AdaptiveIconDrawable][aid]) | Rounded mask and drop shadow ([Play spec][play]) |

## Apple: iOS, iPadOS, macOS

### Icon Composer makes one layered file for four platforms

- Icon Composer builds a single multilayer file for iOS, iPadOS, macOS, watchOS, and the App Store ([Xcode doc][ic-doc]).
- The file type is `.icon`. You save the `.icon` file, drag it into Xcode, and choose it in the project editor ([WWDC25 361][w361]).
- Icon Composer first shipped bundled with Xcode 26 ([What's new in Xcode 26][w247]).
- The standalone download now requires macOS Tahoe 26.4 or later ([Icon Composer page][icp]).
- The **App Icon** field in the target's General pane must match the `.icon` file name without the extension. The latest Xcode uses the `.icon` file instead of an existing `AppIcon` asset catalog ([Xcode doc][ic-doc]).
- The WWDC26 lab says the way to add the file to Xcode has not changed since 2025. The file sits next to the asset catalog, not inside it ([WWDC26 lab][w26lab]).

### Groups, layers, and the four-group limit

- You drag SVG or PNG files into the sidebar. Each file becomes a layer. A folder becomes a group ([Xcode doc][ic-doc]).
- Apple's doc says to organize the layers into a maximum of four groups. The groups become the layers that the platform renders for depth, from bottom to top ([Xcode doc][ic-doc]).
- The WWDC25 session says the default is one group and the limit is four ([WWDC25 361][w361]).
- Liquid Glass settings apply per group. A group's mode is **Individual** (each layer gets its own glass) or **Combined** (the layers act as one object) ([Xcode doc][ic-doc]).

### What Icon Composer adds, so the artwork must not

- Icon Composer adds the Liquid Glass material to every imported layer. Per group you set specular highlights (off, automatic, inside, outside), blur, refraction, translucency, and shadow ([Xcode doc][ic-doc]).
- Before export, remove blurs, shadows, and specular, opacity, and translucency settings from the source art. Also remove background colours and gradients ([Xcode doc][ic-doc]).
- The HIG says the system applies these effects, so the art needs no specular highlights, drop shadows, bevels, blurs, or glows ([HIG][hig]).
- Apple's designer describes the target source art as "flat, opaque, and easy to control later" ([WWDC25 361][w361]).
- Don't export the rounded-rectangle or circle mask. The system applies the mask ([Xcode doc][ic-doc]). Pre-masked layers make edges jagged and hurt the specular highlights ([HIG][hig]).
- Avoid soft or feathered edges on foreground shapes ([HIG][hig]).

### Background and per-appearance overrides

- You set the background in the document itself. Select the icon file name in the sidebar and choose a solid fill or a gradient ([Xcode doc][ic-doc]). Icon Composer offers System Light and System Dark presets ([WWDC25 361][w361]).
- An imported background layer must be full-bleed and opaque ([HIG][hig]).
- Fill, opacity, and blend mode are set per appearance by default. Other properties apply to all appearances unless you add a variant ([WWDC25 361][w361]).
- **Vary for** in the Style inspector adds an override for one appearance or one platform ([Xcode doc][ic-doc]).

### Appearances

- People choose default, dark, clear, or tinted icons on iOS, iPadOS, and macOS ([HIG][hig]).
- The spec table lists six: default, dark, clear light, clear dark, tinted light, tinted dark ([HIG][hig]).
- In Icon Composer you annotate three of them: Default, Dark, and Mono. Mono produces the clear and tinted variants ([WWDC25 361][w361], [Xcode doc][ic-doc]).
- The system generates any variant you don't provide ([HIG][hig]).
- For mono, set the most recognizable element to white and map the other colours to greys. Icon Composer converts automatically, but you should tune the result ([WWDC25 361][w361]).

### Canvas, grid, and shape

- iOS, iPadOS, and macOS use a 1024 x 1024 px square layout that the system masks to a rounded rectangle ([HIG][hig]).
- The 2025 grid has a rounder corner radius and simpler spacing. Circular artwork gets its own frame in the grid ([WWDC25 220][w220]).
- macOS icons can no longer extend past the shape. The canvas shape masks the design. Odd-shaped legacy Mac icons get their shadows removed and are scaled into the rounded rectangle ([WWDC25 220][w220]).
- App icons support sRGB, Gray Gamma 2.2, and Display P3 ([HIG][hig]).

### What changed in 2026

- The HIG change log lists "Refined guidance for Liquid Glass" on June 8, 2026 and "Added guidance for app icon format options" on October 28, 2026 ([HIG][hig]).
- The 2026 rendering makes the glass sharper. It adds refraction as an optional per-group effect, and Icon Composer previews how the icon looks on earlier releases ([Platforms State of the Union 2026][w26sotu]).
- A 2025 `.icon` file picks up the iOS 27 look without a recompile. Apple also reduced translucency in 2026, and that change needs a manual review per icon ([WWDC26 lab][w26lab]).
- Before version 27, Inside and Outside specular settings both show as on, and refraction has no visible effect ([Xcode doc][ic-doc]).

### Flat bitmap icons still work

- You can still ship a flat PNG. The system then tries to split it into a foreground and a background layer ([HIG][hig]).
- Automatic segmentation applies glass only to large, simple shapes. Text and thin lines get no glass ([HIG][hig]).

### Older OS versions

- If the minimum deployment target includes releases without Liquid Glass, Xcode generates app icon images for those releases from the `.icon` file at build time ([Xcode doc][ic-doc]).
- The `.icon` file replaces the asset catalog icon. To keep a different, older icon on older releases, keep using the asset catalog ([Xcode doc][ic-doc]).

## Apple: watchOS

- watchOS uses the same `.icon` file. The canvas is 1088 x 1088 px and the system masks it to a circle ([HIG][hig], [Xcode doc][ic-doc]).
- The 1088 px canvas overshoots the rounded rectangle and uses the same grid, so one design translates between platforms ([WWDC25 220][w220]).
- watchOS has no appearance variants ([Xcode doc][ic-doc]).
- Don't use a black background on watchOS ([HIG][hig]).
- Relevance for Hummlist: low. The app has no watchOS target. The square-to-circle rule still matters, because Android and visionOS also mask to a circle.

## Apple: visionOS

- A visionOS icon has a background layer and one or two layers on top. The system adds shadows between layers and uses the alpha of the upper layers for an embossed look ([HIG][hig]).
- Three layers is the maximum for visionOS. The layers live in an image stack in the asset catalog, not in Icon Composer ([asset catalog doc][cfg], [HIG][hig]).
- Each layer is a 1024 x 1024 px square. Both foreground layers have a transparent background. The background is an edge-to-edge square ([WWDC23][w23]).
- The system crops all layers with a circular mask ([WWDC23][w23], [HIG][hig]).
- The icon expands when someone looks at it ([WWDC23][w23]). Apple describes visionOS as a 3D effect from flat layers. Apple uses the word parallax for tvOS ([WWDC23][w23], [HIG][hig]).
- Keep graphics centered, because content near the edge looks off-center when the icon expands ([WWDC23][w23]).
- Avoid large semi-transparent areas, because they blend with the shadow behind them ([WWDC23][w23]).
- Avoid shapes in the background that should look like holes. The system's shadows make them stand out ([HIG][hig]).
- Parallax Exporter saves visionOS icons as `.xlsr` files for import into the asset catalog ([asset catalog doc][cfg]).

## Android: adaptive icons

### Layers and sizes

- An adaptive icon needs a foreground layer and a background layer. A monochrome layer is optional and enables themed icons ([adaptive][adaptive]).
- Each layer is 108 x 108 dp ([adaptive][adaptive]).
- The logo is at least 48 x 48 dp and at most 66 x 66 dp. The inner 66 x 66 dp is never clipped by an OEM mask ([adaptive][adaptive]).
- The class reference says the inner 72 x 72 dp shows in the masked viewport. The outer 18 dp on each side is reserved for visual effects such as parallax or pulsing ([AdaptiveIconDrawable][aid]).
- Layers need clean edges and no masks or background shadows ([adaptive][adaptive]).
- `AdaptiveIconDrawable` was added in API level 26 (Android 8.0) ([AdaptiveIconDrawable][aid], [Play spec][play]).

### Masks and motion

- Each OEM provides one mask, and the system draws every adaptive icon with it. Examples are a circle and a squircle ([adaptive][adaptive]).
- Supported launchers generate the motion effects, and the effects vary by launcher ([adaptive][adaptive]).
- `android:roundIcon` is optional. Launchers that show round icons apply a circular mask to it ([adaptive][adaptive]).

### Formats and densities

- Layers can be vectors or bitmaps. Vectors are preferred ([adaptive][adaptive]).
- The adaptive icon XML goes in `res/mipmap-anydpi-v26/ic_launcher.xml` ([adaptive][adaptive]).
- Bitmap app icons belong in `mipmap-` directories, not `drawable-`. Launchers can show an icon up to 25% larger than the density bucket calls for ([densities][dens]).
- The density scale is ldpi 0.75x, mdpi 1x, hdpi 1.5x, xhdpi 2x, xxhdpi 3x, xxxhdpi 4x ([densities][dens]).
- Legacy launcher icons cover Android 7.1 (API level 25) and lower ([Android Studio][studio]).
- Image Asset Studio has a Monochrome tab next to Foreground and Background since Android Studio Narwhal Feature Drop 2025.1.3 Canary 2 ([Panda 2 notes][panda2]).

### Themed icons and the 2025 changes

- Android 13 (API level 33) added themed icons. The launcher tints the monochrome layer with the wallpaper and theme colours if the user turns themed icons on and the launcher supports it ([Android 13][a13], [adaptive][adaptive]).
- Since Android 16 QPR2, Android themes icons automatically for apps without a monochrome layer. It runs a colour-filtering algorithm over the existing launcher icon ([adaptive][adaptive], [Android 16 behaviour changes][a16], [QPR2 Beta 1][qpr2b1]).
- Google still recommends shipping your own monochrome layer to control the result ([QPR2 Beta 1][qpr2b1], [Android 16 behaviour changes][a16]).
- Since Android 16 QPR2, users pick an icon shape from a list. The shape applies to all app icons and folder previews ([QPR2 notes][qpr2rn], [QPR2 release post][qpr2blog], [Google blog][gblog]).
- A monochrome layer is not mandatory for every app. It is required to qualify for Google's Apps Experience Program (AEP) ([AEP themed icons][aep]).
- The Android 17 behaviour-change and feature pages fetched for this research mention no launcher icon changes ([Android 17 all apps][a17], [Android 17 targeting][a17t], [Android 17 features][a17f]).

## Google Play store listing icon

- 512 x 512 px, 32-bit PNG, sRGB, at most 1024 KB ([Play spec][play]).
- Upload a full square. Play applies the rounded mask, with a radius of 30% of the icon size, and the drop shadow ([Play spec][play]).
- Don't add a drop shadow or rounded corners to the asset. Shadows and lighting inside the artwork are allowed ([Play spec][play]).
- Pick an opaque background. A transparent asset shows Play's UI colour behind it ([Play spec][play]).
- Use the keyline grid for a logo with a defined shape. Use the full square for a logo without one ([Play spec][play]).
- No text or graphics for rankings, deals, or Play programs ([Play spec][play]).
- Image Asset Studio generates the 512 x 512 Play image together with the launcher icons ([Android Studio][studio]).

## Could not confirm from an official source

- **visionOS layer file format.** No fetched Apple page says the visionOS layers must be PNG. The asset catalog doc says only "images" and `.xlsr`.
- **`.solidimagestack`.** The `AppIcon.solidimagestack` bundle name appeared only in Apple Developer Forums search snippets, not in documentation. Not fetched, not cited.
- **visionOS background opaque.** WWDC23 says the background is edge to edge and the foregrounds are transparent. "Opaque" for the visionOS background appeared only in a forum search snippet about an Xcode error. The HIG's "full-bleed and opaque" rule is written for Icon Composer backgrounds.
- **A visionOS parallax.** Apple uses "parallax" for tvOS. For visionOS it describes an icon that expands and gains depth when viewed. A visionOS parallax is not confirmed.
- **"72 dp visible" in the guide.** The adaptive icons guide does not state 72 dp. Only the `AdaptiveIconDrawable` reference does. The guide uses 66 dp as the safe zone.
- **Material 3 Expressive shapes as launcher masks.** `m3.material.io` renders client-side, and the fetch returned no text. No official page ties the Android 16 QPR2 user shapes to the Material 3 Expressive shape library. The list of shapes users can pick is not documented.
- **Monochrome mandatory on Android 16 or 17.** No official page makes the monochrome layer mandatory. It is optional, and auto-theming covers apps without one since 16 QPR2.
- **Android 17 icon changes.** None found. Absence from the three Android 17 pages is not proof that no change exists.
- **Small Apple icon sizes such as 29 pt and 16 px.** The current HIG no longer lists per-size icons. It says the system scales the icon down for Settings and notifications. The 29 pt Settings size and the 16 px Mac list size come from older HIG versions and are not confirmed today.
- **Exact icon grid geometry.** The grids live in Apple's design templates (Figma, Sketch, Photoshop, Illustrator). The templates were not downloaded, so no grid numbers are given here.
- **Back-deployment edge cases.** Forum threads about `.icon` back-deployment bugs in Xcode 26 betas appeared in search results. They were not fetched and are not used.

## What this means for Hummlist's icon

- **Draw flat, opaque layers.** No baked-in shadows, gloss, bevels, blurs, or glows. Apple adds them in Icon Composer and Play adds its own shadow. Draw shadows on Android only inside the artwork, if at all.
- **Split the art by depth and by colour.** Keep at most four groups for Apple. A background plus one or two foreground shapes fits all of Apple's limits, including visionOS's three layers.
- **Set the background in Icon Composer.** Use a solid colour or a soft gradient, not an exported image. Apple recommends a coloured background over pure white or black.
- **Keep the motif inside the central safe circle.** On Android that is 66 dp of the 108 dp canvas. Apple's circle platforms and the user-chosen Android shapes make the same demand. Fill the full square with the background so every mask has something to cut.
- **Export SVG with outlined text, and never export the mask.** On Android, use vector drawables for the foreground and monochrome layers.
- **Make the monochrome version read as one colour.** On Android it is a single-colour layer that the launcher tints. On Apple, make the main element white and the rest greys. Test the clear and tinted variants over a busy wallpaper.
- **Keep the same features in every appearance.** Do not swap elements between default, dark, and mono.
- **Check legibility at small sizes.** Hummlist's own test sizes are 29 px and 16 px, which this research could not confirm as current Apple sizes. Avoid thin lines, sharp corners, and text. Use bold strokes and round corners.
- **Ship one 512 x 512 Play PNG.** Make it a full square with an opaque background and no rounded corners or shadow.

## Sources

All fetched on 2026-10-31.

[hig]: https://developer.apple.com/design/human-interface-guidelines/app-icons
[ic-doc]: https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer
[cfg]: https://developer.apple.com/documentation/xcode/configuring-your-app-icon
[icp]: https://developer.apple.com/icon-composer/
[w220]: https://developer.apple.com/videos/play/wwdc2025/220/
[w361]: https://developer.apple.com/videos/play/wwdc2025/361/
[w247]: https://developer.apple.com/videos/play/wwdc2025/247/
[w23]: https://developer.apple.com/videos/play/wwdc2023/10076/
[w26lab]: https://developer.apple.com/videos/play/wwdc2026/8012/
[w26sotu]: https://developer.apple.com/videos/play/wwdc2026/102/
[adaptive]: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
[aid]: https://developer.android.com/reference/android/graphics/drawable/AdaptiveIconDrawable
[play]: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
[dens]: https://developer.android.com/training/multiscreen/screendensities
[studio]: https://developer.android.com/studio/write/create-app-icons
[panda2]: https://developer.android.com/studio/releases/past-releases/as-panda-2-release-notes
[a13]: https://developer.android.com/about/versions/13/features
[a16]: https://developer.android.com/about/versions/16/behavior-changes-all
[qpr2rn]: https://developer.android.com/about/versions/16/qpr2/release-notes
[qpr2b1]: https://android-developers.googleblog.com/2025/08/android-16-qpr2-beta-1-is-here.html
[qpr2blog]: https://android-developers.googleblog.com/2025/12/android-16-qpr2-is-released.html
[gblog]: https://blog.google/products-and-platforms/platforms/android/android-16-december/
[aep]: https://developer.android.com/distribute/aep/aep-req-theme-app-icons
[a17]: https://developer.android.com/about/versions/17/behavior-changes-all
[a17t]: https://developer.android.com/about/versions/17/behavior-changes-17
[a17f]: https://developer.android.com/about/versions/17/features

- Apple, Human Interface Guidelines, [App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) (fetched as `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/app-icons.json`, change log entry 2026-10-28).
- Apple, Xcode documentation, [Creating your app icon using Icon Composer](https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer) (fetched as its `tutorials/data/documentation/xcode/...json` form).
- Apple, Xcode documentation, [Configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon) (fetched as its JSON form).
- Apple, [Icon Composer](https://developer.apple.com/icon-composer/).
- Apple, WWDC25, [Say hello to the new look of app icons](https://developer.apple.com/videos/play/wwdc2025/220/).
- Apple, WWDC25, [Create icons with Icon Composer](https://developer.apple.com/videos/play/wwdc2025/361/).
- Apple, WWDC25, [What's new in Xcode 26](https://developer.apple.com/videos/play/wwdc2025/247/).
- Apple, WWDC23, [Design for spatial user interfaces](https://developer.apple.com/videos/play/wwdc2023/10076/).
- Apple, WWDC26, [Icon Composer for Beginners Group Lab](https://developer.apple.com/videos/play/wwdc2026/8012/).
- Apple, WWDC26, [Platforms State of the Union](https://developer.apple.com/videos/play/wwdc2026/102/).
- Android Developers, [Adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) (last updated 2026-10-22).
- Android Developers, [AdaptiveIconDrawable](https://developer.android.com/reference/android/graphics/drawable/AdaptiveIconDrawable).
- Android Developers, [Google Play icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications).
- Android Developers, [Support different pixel densities](https://developer.android.com/training/multiscreen/screendensities).
- Android Developers, [Create app icons](https://developer.android.com/studio/write/create-app-icons).
- Android Developers, [Android Studio Panda 2 release notes](https://developer.android.com/studio/releases/past-releases/as-panda-2-release-notes).
- Android Developers, [Android 13 features](https://developer.android.com/about/versions/13/features).
- Android Developers, [Android 16 behavior changes, all apps](https://developer.android.com/about/versions/16/behavior-changes-all).
- Android Developers, [Android 16 QPR2 release notes](https://developer.android.com/about/versions/16/qpr2/release-notes).
- Android Developers Blog, [Android 16 QPR2 Beta 1 is here](https://android-developers.googleblog.com/2025/08/android-16-qpr2-beta-1-is-here.html).
- Android Developers Blog, [Android 16 QPR2 is Released](https://android-developers.googleblog.com/2025/12/android-16-qpr2-is-released.html).
- Google, The Keyword, [Stay organized and express yourself with Android 16's new updates](https://blog.google/products-and-platforms/platforms/android/android-16-december/).
- Android Developers, [AEP guideline: Themed App Icons](https://developer.android.com/distribute/aep/aep-req-theme-app-icons) (last updated 2026-08-26).
- Android Developers, Android 17 [behavior changes, all apps](https://developer.android.com/about/versions/17/behavior-changes-all), [behavior changes, apps targeting 17](https://developer.android.com/about/versions/17/behavior-changes-17), and [features and APIs](https://developer.android.com/about/versions/17/features).
