package com.jugaadvision.app

import android.app.Application
import com.jugaadvision.app.data.remote.ApiClient
import com.jugaadvision.app.data.repository.JugaadRepository

class JugaadVisionApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        ApiClient.init(this)
        repository = JugaadRepository(ApiClient.api)
    }

    companion object {
        lateinit var instance: JugaadVisionApp
            private set
        lateinit var repository: JugaadRepository
            private set
    }
}
