'use client'

import { useRef, useState, useCallback } from 'react'
import { Camera, Trash2, ZoomIn } from 'lucide-react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  onChange: (avatarUrl: string | null) => void
}

const OUTPUT_SIZE = 512
const AVATAR_PATH = (userId: string) => `${userId}/avatar.jpg`

// Draws the cropped region onto a fixed-size square canvas and re-encodes to
// JPEG — same shape as ScheduleImportModal's toJpeg() downscale helper, just
// with an explicit crop rect instead of a "fit within an area" scale.
async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not read that image. Try a JPEG or PNG photo.'))
    el.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')!
  // JPEG has no alpha — paint white first so a transparent PNG source
  // doesn't render on black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process that image.')), 'image/jpeg', 0.85)
  })
}

/**
 * Picker + crop + upload control for a profile picture. Always writes to the
 * same Storage path (avatars/<user_id>/avatar.jpg) so a re-upload cleanly
 * overwrites — and always appends a fresh ?v=timestamp to the stored URL so
 * viewers who already loaded the old image see the new one, not a cached
 * copy of the old object at the same path.
 */
export function AvatarUpload({ userId, currentAvatarUrl, onChange }: AvatarUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pickedSrc, setPickedSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    setPickedSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const closeCropper = () => {
    if (pickedSrc) URL.revokeObjectURL(pickedSrc)
    setPickedSrc(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleSave = async () => {
    if (!pickedSrc || !croppedAreaPixels) return
    setSaving(true)
    setError(null)
    try {
      const blob = await getCroppedBlob(pickedSrc, croppedAreaPixels)
      const path = AVATAR_PATH(userId)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const versionedUrl = `${publicUrl}?v=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: versionedUrl })
        .eq('id', userId)
      if (updateError) throw updateError

      onChange(versionedUrl)
      closeCropper()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save your photo.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId)
      if (updateError) throw updateError
      // Best-effort — RLS already scopes this to the caller's own object, and
      // a failed cleanup here shouldn't block the profile change they asked for.
      await supabase.storage.from('avatars').remove([AVATAR_PATH(userId)]).catch(() => {})
      onChange(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove your photo.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5"
        >
          <Camera className="w-3.5 h-3.5" /> {currentAvatarUrl ? 'Change Photo' : 'Add Photo'}
        </Button>
        {currentAvatarUrl && (
          <Button
            type="button"
            variant="danger-outline"
            size="sm"
            loading={removing}
            onClick={handleRemove}
            className="gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </Button>
        )}
      </div>

      <Modal open={!!pickedSrc} onClose={closeCropper} title="Crop Your Photo" size="sm">
        {pickedSrc && (
          <div className="space-y-4">
            <div className="relative w-full h-64 bg-text/5 rounded-lg overflow-hidden">
              <Cropper
                image={pickedSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-text/40 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full"
                aria-label="Zoom"
              />
            </div>
            {error && <p className="text-xs text-warning">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeCropper} className="flex-1">
                Cancel
              </Button>
              <Button type="button" loading={saving} onClick={handleSave} className="flex-1">
                Save Photo
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
