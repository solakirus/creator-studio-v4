; Picked up by electron-builder automatically (build/ is buildResources).
;
; Installing a new version first runs the old version's uninstaller. When that
; fails — a file still locked by a grabber helper (yt-dlp, ffmpeg, its browser),
; or an old uninstaller that is itself broken — the stock installer stops with
; "Failed to uninstall old application files ... : 2" and leaves the OLD app in
; place. That is how a laptop ended up running an old grabber while update.bat
; thought it had installed the new one.
;
; The new files are written over the old ones either way, so a failed clean-up
; of the old copy is noted in the log and the install carries on.

!macro customUnInstallCheck
  ${if} $R0 != 0
    DetailPrint "The old version didn't uninstall cleanly (code $R0) - installing over it."
  ${endif}
  ClearErrors
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro customUnInstallCheck
!macroend
