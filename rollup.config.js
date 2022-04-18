import extension from 'rollup-plugin-gsext'
import sass from 'rollup-plugin-sass'
import del from 'rollup-plugin-delete'

export default {
  input: [
    'src/metadata.json',
    'src/stylesheet.scss'
  ],
  output: {
    dir: 'dist',
    format: 'esm'
  },
  plugins: [
    extension(),
    sass({
      output: 'dist/stylesheet.css'
    }),
    del({
      hook: 'writeBundle',
      targets: [
        'dist/stylesheet.js'
      ]
    })
  ]
}
