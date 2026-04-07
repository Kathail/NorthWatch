from apscheduler.schedulers.background import BackgroundScheduler


def init_scheduler(app):
    scheduler = BackgroundScheduler()

    def run_with_context(func):
        def wrapper():
            with app.app_context():
                func()
        return wrapper

    from app.services.hydroone import fetch_power_outages
    from app.services.ontario511 import fetch_road_conditions
    from app.services.weather import fetch_weather_alerts

    scheduler.add_job(
        run_with_context(fetch_road_conditions),
        "interval",
        minutes=10,
        id="road_conditions",
    )
    scheduler.add_job(
        run_with_context(fetch_power_outages),
        "interval",
        minutes=10,
        id="power_outages",
    )
    scheduler.add_job(
        run_with_context(fetch_weather_alerts),
        "interval",
        minutes=15,
        id="weather_alerts",
    )

    scheduler.start()

    with app.app_context():
        fetch_road_conditions()
        fetch_power_outages()
        fetch_weather_alerts()

    return scheduler
