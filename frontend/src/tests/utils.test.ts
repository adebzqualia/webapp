import { describe, expect, it } from 'vitest'
import { columnLabel, rangeAddress, formatBytes, joinUrl } from '../utils'

describe('utilitaires de grille Excel', () => {
  it('convertit les index en colonnes Excel', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
    expect(columnLabel(701)).toBe('ZZ')
  })

  it('normalise une plage sélectionnée dans les deux directions', () => {
    expect(rangeAddress({ row: 8, column: 7 }, { row: 6, column: 1 })).toBe('B7:H9')
  })
})

describe('utilitaires généraux', () => {
  it('formate la taille des fichiers', () => {
    expect(formatBytes(1_048_576)).toBe('1 Mo')
  })

  it('joint les URL sans double slash', () => {
    expect(joinUrl('http://localhost:8000/api/', '/templates')).toBe('http://localhost:8000/api/templates')
  })
})
