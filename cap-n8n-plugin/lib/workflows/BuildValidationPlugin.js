const cds = require('@sap/cds')
const { validateWorkflowAnnotations } = require('./validate')

function loadBuildApi() {
  if (cds.build?.Plugin && cds.build?.BuildError) return cds.build

  try {
    return require('@sap/cds-dk/lib/build')
  } catch {
    return {}
  }
}

const buildApi = loadBuildApi()
const BasePlugin = buildApi.Plugin || class {}
const BuildError = buildApi.BuildError || Error

class BuildValidationPlugin extends BasePlugin {
  static taskDefaults = {
    src: '.',
    dest: 'n8n-validation'
  }

  async build() {
    if (typeof this.model !== 'function') return

    const csn = await this.model()
    if (!csn) return

    const result = await validateWorkflowAnnotations({
      appRoot: cds.root,
      csn
    })

    for (const diagnostic of result.diagnostics) {
      this.pushMessage(
        diagnostic.message,
        diagnostic.severity === 'error' ? BuildValidationPlugin.ERROR : BuildValidationPlugin.WARNING
      )
    }

    if (result.errors.length > 0) {
      throw new BuildError('n8n workflow validation failed.', result.errors.map((diagnostic) => diagnostic.message))
    }

    return result
  }
}

module.exports = {
  BuildValidationPlugin
}
