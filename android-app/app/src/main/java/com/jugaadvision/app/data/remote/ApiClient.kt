package com.jugaadvision.app.data.remote

import android.content.Context
import com.google.gson.GsonBuilder
import com.jugaadvision.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val DEFAULT_BASE_URL = "https://jugaadvision.vercel.app/api/"

    val baseUrl: String
        get() = try {
            BuildConfig.API_BASE_URL
        } catch (e: Exception) {
            DEFAULT_BASE_URL
        }

    lateinit var api: JugaadApi
        private set

    private var retrofit: Retrofit? = null

    fun init(context: Context) {
        if (retrofit != null) return

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()

        val gson = GsonBuilder().setLenient().create()

        retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()

        api = retrofit!!.create(JugaadApi::class.java)
    }
}
